import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Rate-limit counters shared across every replica.
 *
 * The built-in ThrottlerStorageService keeps counters in a `Map`, so they live
 * only inside the process that created them. On Railway the request reaches a
 * replica chosen by the edge, which meant the 300 req/min limit applied per
 * replica: 1200 requests to one public endpoint inside a single 60s window
 * produced zero 429s, because the hits were divided between instances that each
 * believed they had seen a handful of requests. A DDoS gets N times the
 * intended budget, where N is the replica count.
 *
 * Redis makes the counters shared, so the limit means the same thing on every
 * instance and survives a restart or a rolling deploy.
 *
 * The increment is one round trip using INCR, plus EXPIRE only on the first hit
 * of a window. That mirrors the default "fixed window per key" behaviour: the
 * window is anchored to the first request in it rather than sliding, so a client
 * can burst twice the limit across a window boundary. That is the standard
 * trade-off, and it matches what the in-process version did.
 *
 * If REDIS_URL is unset or Redis is unreachable, this falls back to an in-process
 * Map so a cache outage degrades the rate limit to per-replica rather than
 * taking the API down with it.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
    private readonly logger = new Logger(RedisThrottlerStorage.name);
    private client: Redis | null = null;
    private fallback = new Map<string, { totalHits: number; expiresAt: number; isBlocked: boolean; blockExpiresAt: number }>();

    constructor() {
        const url = process.env.REDIS_URL;
        if (!url) {
            this.logger.warn('REDIS_URL is not set — rate limits will be per-replica (in-memory).');
            return;
        }
        try {
            this.client = new Redis(url, {
                // Do not queue commands while disconnected: a queued INCR that
                // resolves long after the client got its 429 is worse than an
                // honest failure, and an unbounded queue under load is how you
                // turn a Redis blip into an OOM.
                enableOfflineQueue: false,
                maxRetriesPerRequest: 2,
                connectTimeout: 3000,
                // The counter is a security control, not a cache. Persisting it
                // means a Redis restart cannot hand every client a fresh budget.
                lazyConnect: true,
            });
            this.client.on('error', (err) => {
                this.logger.error(`Redis error, falling back to in-memory counters: ${err.message}`);
            });
        } catch (err) {
            this.logger.error(`Could not create Redis client: ${(err as Error).message}`);
            this.client = null;
        }
    }

    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            await this.client.quit().catch(() => undefined);
        }
    }

    async increment(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName: string,
    ): Promise<ThrottlerStorageRecord> {
        if (!this.client) return this.incrementLocal(key, ttl, limit, blockDuration, throttlerName);

        const redisKey = `rl:${throttlerName}:${key}`;
        const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));

        try {
            if (!(await this.client.ping())) throw new Error('ping failed');

            const totalHits = await this.client.incr(redisKey);
            if (totalHits === 1) {
                // Anchor the window to its first hit.
                await this.client.expire(redisKey, ttlSeconds);
            }
            const remainingTtl = await this.client.ttl(redisKey);

            // A separate key holds the block so that clearing it cannot race with
            // the hit counter's own TTL.
            const blockKey = `${redisKey}:blocked`;
            const isBlocked = (await this.client.exists(blockKey)) === 1;

            if (!isBlocked && totalHits > limit) {
                const blockSeconds = Math.max(1, Math.ceil(blockDuration / 1000));
                await this.client.set(blockKey, '1', 'EX', blockSeconds);
                return {
                    totalHits,
                    timeToExpire: Math.max(0, remainingTtl),
                    isBlocked: true,
                    timeToBlockExpire: blockSeconds,
                };
            }

            let timeToBlockExpire = 0;
            if (isBlocked) {
                timeToBlockExpire = Math.max(0, await this.client.ttl(blockKey));
            }

            return {
                totalHits,
                timeToExpire: Math.max(0, remainingTtl),
                isBlocked,
                timeToBlockExpire,
            };
        } catch (err) {
            this.logger.warn(`Redis increment failed (${(err as Error).message}); using in-memory counters.`);
            return this.incrementLocal(key, ttl, limit, blockDuration, throttlerName);
        }
    }

    private incrementLocal(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName: string,
    ): ThrottlerStorageRecord {
        const now = Date.now();
        // Scope the counter to the throttler as well as the tracker. NestJS can
        // run several throttlers over the same request (a global default plus a
        // stricter one on, say, /auth/login), and they must not spend each
        // other's budget. The Redis key above does the same via `rl:<name>:`.
        const composite = `${throttlerName}:${key}`;
        let entry = this.fallback.get(composite);
        if (!entry) {
            entry = { totalHits: 0, expiresAt: now + ttl, isBlocked: false, blockExpiresAt: 0 };
            this.fallback.set(composite, entry);
        }
        if (entry.expiresAt <= now) {
            entry.expiresAt = now + ttl;
            entry.totalHits = 0;
        }
        if (entry.blockExpiresAt && entry.blockExpiresAt <= now) {
            entry.isBlocked = false;
            entry.blockExpiresAt = 0;
        }
        if (!entry.isBlocked) entry.totalHits += 1;
        if (entry.totalHits > limit && !entry.isBlocked) {
            entry.isBlocked = true;
            entry.blockExpiresAt = now + blockDuration;
        }
        return {
            totalHits: entry.totalHits,
            timeToExpire: Math.max(0, Math.ceil((entry.expiresAt - now) / 1000)),
            isBlocked: entry.isBlocked,
            timeToBlockExpire: Math.max(0, Math.ceil((entry.blockExpiresAt - now) / 1000)),
        };
    }
}
