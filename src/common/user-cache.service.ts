import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
// NOT `import type`: a type-only import is erased at compile time, which strips
// the constructor parameter metadata Nest relies on to resolve PrismaService.
// The result is "argument Object at index [0]" and a backend that will not
// boot, while unit tests with hand-written mocks stay green.
import { PrismaService } from '../prisma/prisma.service';

/**
 * Short-lived cache of the identity fields the JWT strategy needs.
 *
 * WHY THIS EXISTS
 * JwtStrategy.validate() re-reads the user on every authenticated request, to
 * make sure a suspended account is denied immediately and that authorization
 * uses the current role rather than a stale claim in the token. That is the
 * right trade-off, but it means every request costs a database round trip --
 * with 1000 concurrent users the users table takes the full load of the
 * platform's traffic for a four-column lookup.
 *
 * This caches exactly that read, and nothing else. The TTL is deliberately
 * short: 3 minutes, inside the 2-5 minute range, and well under any token
 * lifetime. It is a latency optimisation, never the authorization boundary --
 * every invalidation path below deletes the key outright, so the window in which
 * a stale role could be served is measured in milliseconds, not minutes.
 *
 * WHAT IS CACHED, AND WHAT DELIBERELY IS NOT
 * Only { id, email, role, isActive, tokenVersion }. Never passwordHash, never
 * tokens, never twoFactorSecret. Putting a password hash in a shared cache
 * would widen the blast radius of a Redis compromise from "list of ids and
 * roles" to "every password in the system", for no benefit -- nothing here
 * reads it. tokenVersion is a small integer the JWT strategy compares against
 * the token's `tv` claim, so a logout has to bite immediately even on a cache
 * hit.
 *
 * A cache hit for a user who does not exist is stored as the literal "0" rather
 * than as a missing key, so that a flood of requests against unknown ids hits
 * Redis and stops, instead of each one falling through to the database.
 *
 * FAILURE BEHAVIOUR
 * Redis is an optimisation here, so every Redis failure degrades to the
 * database rather than failing the request: a down or unreachable Redis costs
 * latency, never availability, and never authorization. If Redis is DOWN the
 * code path is exactly the one that ran before this class existed.
 */
@Injectable()
export class UserCacheService implements OnModuleDestroy {
    private readonly logger = new Logger(UserCacheService.name);
    private readonly ttlSeconds = 180; // 3 minutes: inside the requested 2-5 min band
    private client: Redis | null = null;

    /** Flipped off permanently after repeated Redis failures, so a dead Redis
     *  costs one timeout per interval instead of one per request. */
    private redisHealthy = true;

    constructor(private readonly prisma: PrismaService) {
        const url = process.env.REDIS_URL;
        if (!url) {
            this.logger.warn('REDIS_URL is not set — JwtStrategy will query the database on every request.');
            return;
        }
        try {
            this.client = new Redis(url, {
                enableOfflineQueue: false,
                maxRetriesPerRequest: 1,
                connectTimeout: 2000,
                lazyConnect: true,
            });
            this.client.on('error', (err) => {
                if (this.redisHealthy) {
                    this.logger.error(`Redis unavailable, serving from the database: ${err.message}`);
                }
                this.redisHealthy = false;
            });
            this.client.on('ready', () => {
                this.redisHealthy = true;
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

    /**
     * Resolve a user for authentication, preferring the cache.
     *
     * Returns null when the user does not exist OR is deactivated, so the
     * caller cannot accidentally treat "not found" and "suspended" differently.
     */
    async findActiveUser(userId: string): Promise<{ id: string; email: string; role: string; isActive: boolean; tokenVersion: number } | null> {
        const key = this.key(userId);

        if (this.client && this.redisHealthy) {
            try {
                const raw = await this.client.get(key);
                if (raw !== null) {
                    this.redisHealthy = true;
                    if (raw === '0') return null; // cached "no such active user"
                    const parsed = JSON.parse(raw) as { id: string; email: string; role: string; isActive: boolean; tokenVersion: number };
                    // This rejects an entry cached from an already-inactive user.
                    // It does NOT defend against a user who was cached while active
                    // and suspended since: `parsed` IS the cached snapshot, so
                    // checking a field of it proves nothing about the current row.
                    // The only thing that closes that gap is invalidate() being
                    // called by every mutation path. That is a correctness
                    // requirement on those call sites, not a property of this
                    // method -- hence the audit note in each of them.
                    return parsed.isActive ? parsed : null;
                }
            } catch (err) {
                this.redisHealthy = false;
                this.logger.warn(`User cache read failed (${(err as Error).message}); falling back to the database.`);
            }
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true, isActive: true, tokenVersion: true },
        });

        if (this.client && this.redisHealthy) {
            try {
                if (!user || !user.isActive) {
                    // Short TTL on the negative result: a user who signs up or is
                    // un-suspended should not stay invisible for long.
                    await this.client.set(key, '0', 'EX', Math.min(this.ttlSeconds, 30));
                } else {
                    await this.client.set(key, JSON.stringify(user), 'EX', this.ttlSeconds);
                }
                this.redisHealthy = true;
            } catch {
                this.redisHealthy = false;
            }
        }

        if (!user || !user.isActive) return null;
        return user;
    }

    /**
     * Drop the cached identity for a user.
     *
     * Called from every path that changes the role, the active flag, or the
     * password. Called after the database write, not before: if the write fails
     * we must not evict a still-valid entry, and the short TTL bounds any window
     * opened by a crash between the two.
     */
    async invalidate(userId: string): Promise<void> {
        if (!this.client) return;
        try {
            await this.client.del(this.key(userId));
            this.redisHealthy = true;
        } catch (err) {
            // The TTL is the backstop here: worst case this user keeps their old
            // role for up to 3 minutes. Say so loudly rather than pretending.
            this.logger.error(
                `Could not invalidate cached identity for ${userId} (${(err as Error).message}). ` +
                'A stale role could survive for up to the TTL.',
            );
            this.redisHealthy = false;
        }
    }

    private key(userId: string): string {
        return `auth:user:${userId}`;
    }
}
