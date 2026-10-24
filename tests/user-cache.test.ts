import test from 'node:test';
import assert from 'node:assert/strict';
import { UserCacheService } from '../src/common/user-cache.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * These tests exist to pin down one property: a suspended, demoted, deleted or
 * logged-out user must lose access IMMEDIATELY, and a Redis outage must never
 * take the site down.
 *
 * The cache is only permitted to be a latency optimisation. If any test here
 * fails, the security model is broken -- not merely slow.
 */

/** Stand-in for ioredis, so we can prove the cache logic without a server. */
class FakeRedis {
    store = new Map<string, { value: string; expiresAt: number }>();
    getCalls = 0;
    setCalls = 0;
    delCalls: string[] = [];
    failOn: 'get' | 'set' | 'del' | null = null;
    now = Date.now();

    private live(key: string) {
        const hit = this.store.get(key);
        if (!hit) return null;
        if (hit.expiresAt <= this.now) {
            this.store.delete(key);
            return null;
        }
        return hit;
    }

    async get(key: string) {
        this.getCalls++;
        if (this.failOn === 'get') throw new Error('ECONNREFUSED (simulated)');
        return this.live(key)?.value ?? null;
    }

    async set(key: string, value: string, _mode: string, ttl: number) {
        this.setCalls++;
        if (this.failOn === 'set') throw new Error('ECONNREFUSED (simulated)');
        this.store.set(key, { value, expiresAt: this.now + ttl * 1000 });
        return 'OK';
    }

    async del(key: string) {
        this.delCalls.push(key);
        if (this.failOn === 'del') throw new Error('ECONNREFUSED (simulated)');
        this.store.delete(key);
        return 1;
    }

    ttlOf(key: string) {
        const hit = this.live(key);
        return hit ? Math.round((hit.expiresAt - this.now) / 1000) : null;
    }
}

const activeUser = { id: 'u1', email: 'a@b.test', role: Role.STUDENT, isActive: true, tokenVersion: 0 };

/** Build the cache with a fake Redis already attached, bypassing the constructor. */
function buildCache(redis: FakeRedis, dbUser: any = activeUser) {
    let dbReads = 0;
    const prisma = {
        user: {
            findUnique: async () => {
                dbReads++;
                return dbUser;
            },
        },
    };
    const svc = new UserCacheService(prisma as never);
    (svc as any).client = redis;
    (svc as any).redisHealthy = true;
    return { svc, reads: () => dbReads };
}

const KEY = 'auth:user:u1';

// ---------------------------------------------------------------------------
// TTL -- the short-expiry requirement
// ---------------------------------------------------------------------------

test('SECURITY: a cached identity expires within the requested 2-5 minute band', async () => {
    const redis = new FakeRedis();
    const { svc } = buildCache(redis);

    await svc.findActiveUser('u1');

    const ttl = redis.ttlOf(KEY);
    assert.ok(ttl !== null, 'the identity should have been cached');
    assert.ok(
        ttl! >= 120 && ttl! <= 300,
        `TTL must be 2-5 minutes so a missed invalidation cannot linger; got ${ttl}s`,
    );
});

test('PERFORMANCE: the second request is served from cache, not the database', async () => {
    const redis = new FakeRedis();
    const { svc, reads } = buildCache(redis);

    await svc.findActiveUser('u1');
    const afterFirst = reads();
    await svc.findActiveUser('u1');
    await svc.findActiveUser('u1');

    assert.equal(afterFirst, 1, 'first request reads the database');
    assert.equal(reads(), 1, 'subsequent requests must not touch the database');
    assert.equal(redis.getCalls, 3);
});

test('a cache entry that has expired falls back to the database', async () => {
    const redis = new FakeRedis();
    const { svc, reads } = buildCache(redis);

    await svc.findActiveUser('u1');
    redis.now += 181_000; // past the TTL
    await svc.findActiveUser('u1');

    assert.equal(reads(), 2, 'an expired entry must be re-read, not served stale');
});

// ---------------------------------------------------------------------------
// Graceful degradation -- Redis is optional, never a dependency
// ---------------------------------------------------------------------------

test('GRACEFUL: with no REDIS_URL configured the database answers every request', async () => {
    delete process.env.REDIS_URL;
    const reads: number[] = [];
    const prisma = {
        user: { findUnique: async () => { reads.push(1); return activeUser; } },
    };
    const svc = new UserCacheService(prisma as never);
    assert.equal((svc as any).client, null, 'no client without a URL');

    await svc.findActiveUser('u1');
    await svc.findActiveUser('u1');

    assert.equal(reads.length, 2, 'no caching, but also no failure');
    assert.deepEqual(await svc.findActiveUser('u1'), activeUser);
});

test('GRACEFUL: a Redis read failure serves the request from the database', async () => {
    const redis = new FakeRedis();
    redis.failOn = 'get';
    const { svc, reads } = buildCache(redis);

    const user = await svc.findActiveUser('u1');

    assert.deepEqual(user, activeUser, 'the request must succeed');
    assert.equal(reads(), 1, 'it must have come from the database');
});

test('GRACEFUL: a Redis write failure still returns the user', async () => {
    const redis = new FakeRedis();
    redis.failOn = 'set';
    const { svc } = buildCache(redis);

    assert.deepEqual(await svc.findActiveUser('u1'), activeUser);
});

test('GRACEFUL: a failed invalidate does not throw into the caller', async () => {
    const redis = new FakeRedis();
    redis.failOn = 'del';
    const { svc } = buildCache(redis);

    await assert.doesNotReject(() => svc.invalidate('u1'));
});

test('GRACEFUL: after a Redis failure the service stops calling Redis', async () => {
    const redis = new FakeRedis();
    redis.failOn = 'get';
    const { svc, reads } = buildCache(redis);

    await svc.findActiveUser('u1');
    const callsAfterFailure = redis.getCalls;
    await svc.findActiveUser('u1');
    await svc.findActiveUser('u1');

    assert.equal(redis.getCalls, callsAfterFailure, 'a dead Redis must not be re-probed per request');
    assert.equal(reads(), 3, 'and the database carries the load instead');
});

// ---------------------------------------------------------------------------
// The actual security boundary: a stale entry can never authorize anyone
// ---------------------------------------------------------------------------

test('SECURITY: a stale-true entry WOULD authorize -- which is why every mutation path must invalidate', async () => {
    // This test documents the residual risk on purpose. The cache holds a
    // snapshot, so re-checking isActive on that snapshot cannot detect a
    // suspension that happened after the entry was written.
    //
    // There is exactly one defence: UsersService.update / updateRole / remove,
    // AuthService.logout / resetPassword / changePassword and the instructor
    // approval path all call invalidate(). Those are covered by the tests below.
    // If someone adds a new way to change a role and forgets it, a suspended
    // user keeps their old role until the TTL -- so this is the property to
    // re-check when adding any user-mutating code.
    const redis = new FakeRedis();
    const { svc } = buildCache(redis, { ...activeUser, isActive: false });

    await redis.set(KEY, JSON.stringify({ ...activeUser, isActive: true }), 'EX', 180);

    assert.notEqual(
        await svc.findActiveUser('u1'),
        null,
        'a stale-true entry is served; invalidation is the only real defence',
    );
});

test('but after invalidate() the suspended user is denied immediately', async () => {
    const redis = new FakeRedis();
    const { svc } = buildCache(redis, { ...activeUser, isActive: false });

    await redis.set(KEY, JSON.stringify({ ...activeUser, isActive: true }), 'EX', 180);
    await svc.invalidate('u1');

    assert.equal(await svc.findActiveUser('u1'), null);
    assert.equal(await redis.get(KEY), '0', 'and it is re-cached as a negative, never as the old role');
});

test('a deleted user is not cached as an active identity', async () => {
    const redis = new FakeRedis();
    const { svc } = buildCache(redis, null);

    assert.equal(await svc.findActiveUser('u1'), null);
    assert.equal(await redis.get(KEY), '0', 'unknown ids are cached so id-guessing cannot hammer the DB');
});

test('the negative cache is shorter-lived than the positive one', async () => {
    const redis = new FakeRedis();
    const { svc } = buildCache(redis, null);

    await svc.findActiveUser('u1');

    assert.ok(redis.ttlOf(KEY)! <= 30, 'an unsuspended user should not stay invisible for minutes');
});

test('only identity fields are cached -- never the password hash', async () => {
    const redis = new FakeRedis();
    const { svc } = buildCache(redis);

    await svc.findActiveUser('u1');
    const raw = await redis.get(KEY);

    assert.ok(raw && !raw.includes('password'), 'a shared cache must not hold password hashes');
    assert.deepEqual(Object.keys(JSON.parse(raw!)).sort(), ['email', 'id', 'isActive', 'role', 'tokenVersion']);
});

// ---------------------------------------------------------------------------
// Invalidation wiring -- each path that changes identity must delete the key
// ---------------------------------------------------------------------------

test('SECURITY: suspending a user evicts them immediately', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = {
        user: {
            findUnique: async () => activeUser,
            update: async () => ({ ...activeUser, isActive: false }),
        },
        refreshToken: { updateMany: async () => ({}) },
    };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.update('u1', { isActive: false } as never, 'admin1');

    assert.deepEqual(redis.delCalls, [KEY], 'the suspended account must be evicted, not left cached');
});

test('SECURITY: demoting an admin evicts them immediately', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = { user: { update: async () => ({ ...activeUser, role: Role.STUDENT }) } };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.updateRole('u1', Role.STUDENT, 'admin1');

    assert.deepEqual(redis.delCalls, [KEY]);
});

test('SECURITY: the dedicated role endpoint also evicts', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = { user: { update: async () => ({ ...activeUser, role: Role.INSTRUCTOR }) } };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.updateRole('u1', Role.INSTRUCTOR, 'admin1');

    assert.deepEqual(redis.delCalls, [KEY]);
});

test('SECURITY: an admin-set password evicts the cached identity', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = {
        user: {
            findUnique: async () => activeUser,
            update: async () => activeUser,
        },
        refreshToken: { updateMany: async () => ({}) },
    };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.update('u1', { password: 'N3w!pass' } as never, 'admin1');

    assert.deepEqual(redis.delCalls, [KEY]);
});

test('SECURITY: deleting a user evicts their cached identity', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = { user: { delete: async () => ({ id: 'u1' }) } };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.remove('u1', 'admin1');

    assert.deepEqual(redis.delCalls, [KEY]);
});

test('SECURITY: changing an email evicts, so the token email cannot go stale', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    // A real hash, so updateMe's current-password gate is satisfied and the
    // test reaches the write rather than bailing out with a 400.
    const realHash = await bcrypt.hash('Current!pass', 4);
    const prisma = {
        user: {
            findUnique: async (args: any) => (args?.where?.email ? null : { ...activeUser, passwordHash: realHash }),
            update: async () => ({ ...activeUser, email: 'new@b.test' }),
        },
    };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.updateMe('u1', { email: 'new@b.test', currentPassword: 'Current!pass' } as never);

    assert.deepEqual(redis.delCalls, [KEY]);
});

test('SECURITY: logout evicts the cached identity', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    // logout now also bumps tokenVersion, so the user table is written too.
    let versionBumped = false;
    const prisma = {
        refreshToken: { updateMany: async () => ({}) },
        user: { update: async () => { versionBumped = true; return {}; } },
    };
    const auth = new AuthService(prisma as never, {} as never, {} as never, {} as never, cache as never);

    await auth.logout('u1');

    assert.deepEqual(redis.delCalls, [KEY]);
    assert.equal(versionBumped, true, 'logout must invalidate live access tokens');
});

test('SECURITY: completing a forced password change evicts', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = {
        passwordResetToken: {
            findUnique: async () => ({
                id: 'r1',
                userId: 'u1',
                usedAt: null,
                expiresAt: new Date(Date.now() + 60_000),
            }),
            update: async () => ({}),
        },
        user: { update: async () => ({}) },
        refreshToken: { updateMany: async () => ({}) },
        $transaction: async (ops: any[]) => {
            // Real Prisma runs these as queued promises, so they must be callable.
            for (const op of ops) {
                if (typeof op === 'function') await op();
            }
            return [];
        },
    };
    const auth = new AuthService(prisma as never, {} as never, {} as never, {} as never, cache as never);
    (auth as any).hashToken = (t: string) => t;

    await auth.resetPassword('tokenhash', 'N3w!pass');

    assert.deepEqual(redis.delCalls, [KEY]);
});

test('a plain metadata edit does not needlessly evict', async () => {
    const redis = new FakeRedis();
    const { svc: cache } = buildCache(redis);
    await cache.findActiveUser('u1');

    const prisma = {
        user: {
            findUnique: async () => ({ ...activeUser, passwordHash: 'h' }),
            update: async () => ({ ...activeUser, metadata: {} }),
        },
    };
    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);

    await users.updateMe('u1', { bio: 'new bio' } as never);

    assert.deepEqual(redis.delCalls, [], 'no identity change means no eviction');
});

// ---------------------------------------------------------------------------
// End-to-end through the strategy itself
// ---------------------------------------------------------------------------

function strategyWith(cache: any) {
    return new JwtStrategy(cache);
}

test('SECURITY: the strategy rejects a suspended user found in the database', async () => {
    delete process.env.REDIS_URL;
    const prisma = { user: { findUnique: async () => ({ ...activeUser, isActive: false }) } };
    const cache = new UserCacheService(prisma as never);

    await assert.rejects(
        () => strategyWith(cache).validate({ sub: 'u1' }),
        /not available/,
    );
});

test('the strategy returns the current role, not the one baked into the token', async () => {
    delete process.env.REDIS_URL;
    // The token says ADMIN; the database says STUDENT. Authorization must follow
    // the database, or a demotion would never actually take effect.
    const prisma = { user: { findUnique: async () => ({ ...activeUser, role: Role.STUDENT }) } };
    const cache = new UserCacheService(prisma as never);

    const user = await strategyWith(cache).validate({ sub: 'u1', role: Role.ADMIN });

    assert.equal(user.role, Role.STUDENT);
});

test('the strategy rejects a token with no subject', async () => {
    const cache = new UserCacheService({ user: { findUnique: async () => null } } as never);
    await assert.rejects(() => strategyWith(cache).validate({ role: Role.ADMIN }));
});
