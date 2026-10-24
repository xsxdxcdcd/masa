import test from 'node:test';
import assert from 'node:assert/strict';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { UserCacheService } from '../src/common/user-cache.service';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Pins the two properties the earlier code only pretended to have:
 *
 * 1. A stateless access token can be retired. Logout, a password change and a
 *    detected refresh replay all bump User.tokenVersion, and the JWT strategy
 *    refuses a token whose `tv` no longer matches. Before this, "logout" killed
 *    the refresh token and left the access token working until it expired.
 *
 * 2. A replayed refresh token is not merely rejected -- the lineage it belongs
 *    to is revoked. Rejecting one token while leaving its descendants alive
 *    would let a thief who rotated first keep the stolen session.
 *
 * The cache is a mock-free read here: REDIS_URL is deleted so UserCacheService
 * goes straight to the database, which is the production path today.
 */

delete process.env.REDIS_URL;

const dbUser = {
    id: 'u1',
    email: 'a@b.test',
    role: Role.STUDENT,
    isActive: true,
    tokenVersion: 3,
};

function strategyFor(user: any) {
    const cache = new UserCacheService({ user: { findUnique: async () => user } } as never);
    return new JwtStrategy(cache);
}

// --- 1. tokenVersion is enforced at the strategy ---------------------------

test('SECURITY: a token whose tv matches the row is accepted', async () => {
    const user = await strategyFor(dbUser).validate({ sub: 'u1', tv: 3 });
    assert.equal(user.userId, 'u1');
});

test('SECURITY: a token whose tv is stale is rejected', async () => {
    await assert.rejects(
        () => strategyFor(dbUser).validate({ sub: 'u1', tv: 2 }),
        /revoked/,
        'a token issued before the last logout/password change must not work',
    );
});

test('a token minted before tv existed reads as version 0', async () => {
    const fresh = { ...dbUser, tokenVersion: 0 };
    const user = await strategyFor(fresh).validate({ sub: 'u1' });
    assert.equal(user.userId, 'u1', 'deploying the claim must not log anyone out');
});

test('SECURITY: the newest tv is accepted after an older one is revoked', async () => {
    // Simulates refresh having issued a token at version 4 while version 3 is dead.
    const user = await strategyFor({ ...dbUser, tokenVersion: 4 }).validate({ sub: 'u1', tv: 4 });
    assert.equal(user.userId, 'u1');
});

// --- 2. refresh replay revokes the family ----------------------------------

function authWith(prisma: any) {
    const cache = { invalidate: async () => {}, findActiveUser: async () => dbUser };
    const auth = new AuthService(prisma as never, { sign: () => 'tok' } as never, {} as never, {} as never, cache as never);
    (auth as any).hashToken = (t: string) => t;
    return auth;
}

test('SECURITY: replaying a rotated refresh token revokes the whole family', async () => {
    let familyWhere: any = null;
    let increment: any = null;

    const prisma = {
        refreshToken: {
            findUnique: async () => ({
                id: 't1',
                tokenHash: 'raw',
                userId: 'u1',
                familyId: 'fam-1',
                revokedAt: new Date(), // already rotated -> this is the replay
                expiresAt: new Date(Date.now() + 60_000),
            }),
            updateMany: async (args: any) => { familyWhere = args.where; return { count: 2 }; },
        },
        user: {
            update: async (args: any) => { increment = args.data.tokenVersion; return {}; },
        },
        $transaction: async (ops: any[]) => Promise.all(ops),
    };

    await assert.rejects(
        () => authWith(prisma).refresh('raw'),
        /already been used/,
    );

    assert.deepEqual(familyWhere, { familyId: 'fam-1' }, 'the lineage, not just one token, is revoked');
    assert.deepEqual(increment, { increment: 1 }, 'access tokens are retired alongside the refresh tokens');
});

test('a token with no family falls back to revoking every token for the user', async () => {
    let familyWhere: any = null;

    const prisma = {
        refreshToken: {
            findUnique: async () => ({
                id: 'legacy',
                tokenHash: 'raw',
                userId: 'u1',
                familyId: null, // predates the column
                revokedAt: new Date(),
                expiresAt: new Date(Date.now() + 60_000),
            }),
            updateMany: async (args: any) => { familyWhere = args.where; return { count: 1 }; },
        },
        user: { update: async () => ({}) },
        $transaction: async (ops: any[]) => Promise.all(ops),
    };

    await assert.rejects(() => authWith(prisma).refresh('raw'), /already been used/);
    assert.deepEqual(familyWhere, { userId: 'u1' }, 'a legacy row has no family to scope to');
});

test('a normal refresh keeps the family and stamps the current tokenVersion', async () => {
    let created: any = null;
    let signed: any = null;
    const prisma = {
        refreshToken: {
            findUnique: async () => ({
                id: 't1',
                tokenHash: 'raw',
                userId: 'u1',
                familyId: 'fam-1',
                revokedAt: null,
                expiresAt: new Date(Date.now() + 60_000),
            }),
            update: async () => ({}),
            create: async (args: any) => { created = args.data; return {}; },
        },
        user: { findUnique: async () => dbUser },
        $transaction: async (ops: any[]) => Promise.all(ops),
    };

    const cache = { invalidate: async () => {}, findActiveUser: async () => dbUser };
    const auth = new AuthService(prisma as never, { sign: (p: any) => { signed = p; return 'newtok'; } } as never, {} as never, {} as never, cache as never);
    (auth as any).hashToken = (t: string) => t;

    await auth.refresh('raw');

    assert.equal(created.familyId, 'fam-1', 'rotation stays inside the same lineage');
    assert.equal(signed.tv, 3, 'the new access token carries the current version');
});

// --- 3. self password change ends other sessions ---------------------------

test('SECURITY: a self password change revokes refresh tokens and bumps tokenVersion', async () => {
    const cache = { invalidate: async () => {}, findActiveUser: async () => dbUser };
    const realHash = await bcrypt.hash('Current!pass', 4);

    let written: any = null;
    let revokedWhere: any = null;

    const prisma = {
        user: {
            findUnique: async () => ({ ...dbUser, passwordHash: realHash }),
            update: async (args: any) => { written = args.data; return { ...dbUser, updatedAt: new Date(), createdAt: new Date(), metadata: {} }; },
        },
        refreshToken: { updateMany: async (args: any) => { revokedWhere = args.where; return { count: 3 }; } },
    };

    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);
    await users.updateMe('u1', { password: 'N3w!pass', currentPassword: 'Current!pass' } as never);

    assert.deepEqual(written.tokenVersion, { increment: 1 }, 'live access tokens must die');
    assert.deepEqual(revokedWhere, { userId: 'u1' }, 'and every refresh token with them');
});

test('a profile-only edit does not bump the version', async () => {
    const cache = { invalidate: async () => {}, findActiveUser: async () => dbUser };
    let written: any = null;

    const prisma = {
        user: {
            findUnique: async () => ({ ...dbUser, passwordHash: 'h' }),
            update: async (args: any) => { written = args.data; return { ...dbUser, updatedAt: new Date(), createdAt: new Date(), metadata: {} }; },
        },
        refreshToken: { updateMany: async () => ({ count: 0 }) },
    };

    const users = new UsersService(prisma as never, { logAction: async () => {} } as never, cache as never);
    await users.updateMe('u1', { language: 'ar' } as never);

    assert.equal(written.tokenVersion, undefined, 'a cosmetic edit must not log the user out');
});
