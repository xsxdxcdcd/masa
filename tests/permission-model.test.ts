import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { UserCacheService } from '../src/common/user-cache.service';
import { AuthService } from '../src/auth/auth.service';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { AdminBoundaryGuard } from '../src/auth/guards/admin-boundary.guard';
import { PERMISSIONS_KEY } from '../src/auth/decorators/permissions.decorator';
import { ALL_PERMISSIONS, PERMISSIONS, audienceForRole, permissionsForRole } from '../src/auth/permissions/permissions';

/**
 * Phase 2 of the boundary split: the permission model, the audience claim and
 * the two guards that will carry the learner/admin separation once routes
 * move in Phase 3.
 *
 * What is pinned here:
 *
 *  1. The role -> permission map is least-privilege and matches what the
 *     existing @Roles decorators already allow (a narrower grant would make
 *     Phase 3 a silent privilege cut).
 *  2. Authorization reads the CURRENT database role, so neither a privileged
 *     claim inside a token nor a demotion after issuing can widen access.
 *  3. Short-lived single-purpose tokens (2FA challenge, forced password
 *     change, operations grant) are not access tokens -- they used to pass
 *     the strategy whenever tokenVersion still matched its default.
 *  4. The boundary guard refuses /admin paths without an admin-audience
 *     token, and leaves every existing path (including /enrollments/admin)
 *     alone.
 */

const SECRET = 'permission-model-test-secret-0123456789abcdef';
process.env.JWT_SECRET = SECRET;
delete process.env.REDIS_URL;

const jwt = require('jsonwebtoken');

// --- 1. the map -------------------------------------------------------------

test('every permission in the catalog is granted to at least one role', () => {
    const granted = new Set<string>();
    for (const role of Object.values(Role)) {
        for (const permission of permissionsForRole(role)) granted.add(permission);
    }
    for (const permission of ALL_PERMISSIONS) {
        assert.ok(granted.has(permission), `${permission} exists in the catalog but no role holds it`);
    }
});

test('ADMIN holds exactly the catalog -- no hand-maintained copy to forget', () => {
    assert.deepEqual(new Set(permissionsForRole(Role.ADMIN)), new Set(ALL_PERMISSIONS));
});

test('a student holds no platform permissions at all', () => {
    assert.deepEqual(permissionsForRole(Role.STUDENT), [], 'learner routes authorize by ownership, never by capability');
});

test('SECURITY: an unknown role resolves to nothing (fail closed, not fail open)', () => {
    assert.deepEqual(permissionsForRole('SUDO'), []);
    assert.deepEqual(permissionsForRole(''), []);
    assert.equal(audienceForRole('SUDO'), 'learner', 'an unrecognized role belongs to the restricted side of the boundary');
});

test('SECURITY: FINANCE and COURSE_MANAGER are disjoint where it matters', () => {
    const finance = permissionsForRole(Role.FINANCE);
    const manager = permissionsForRole(Role.COURSE_MANAGER);

    for (const permission of [
        PERMISSIONS.COURSES_WRITE,
        PERMISSIONS.CONTENT_WRITE,
        PERMISSIONS.GRADES_WRITE,
        PERMISSIONS.USERS_READ,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.OPS_MANAGE,
        PERMISSIONS.INSTRUCTORS_REVIEW,
    ]) {
        assert.ok(!finance.includes(permission), `FINANCE must not hold ${permission}`);
    }

    for (const permission of [
        PERMISSIONS.PAYMENTS_READ,
        PERMISSIONS.PAYMENTS_REFUND,
        PERMISSIONS.PAYMENTS_SETTINGS,
        PERMISSIONS.REFUNDS_REVIEW,
        PERMISSIONS.FINANCE_READ,
        PERMISSIONS.FINANCE_WRITE,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.USERS_ROLE,
        PERMISSIONS.USERS_DELETE,
        PERMISSIONS.OPS_MANAGE,
    ]) {
        assert.ok(!manager.includes(permission), `COURSE_MANAGER must not hold ${permission}`);
    }
});

test('an instructor can teach but cannot administer the platform', () => {
    const instructor = permissionsForRole(Role.INSTRUCTOR);

    for (const permission of [
        PERMISSIONS.GRADES_WRITE,
        PERMISSIONS.CONTENT_WRITE,
        PERMISSIONS.CERTIFICATES_ISSUE,
        PERMISSIONS.ANALYTICS_READ,
    ]) {
        assert.ok(instructor.includes(permission), `an instructor needs ${permission} to do the job they have today`);
    }

    for (const permission of [
        PERMISSIONS.USERS_WRITE,
        PERMISSIONS.USERS_DELETE,
        PERMISSIONS.USERS_ROLE,
        PERMISSIONS.COURSES_WRITE,
        PERMISSIONS.COURSES_DELETE,
        PERMISSIONS.PAYMENTS_READ,
        PERMISSIONS.FINANCE_READ,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.OPS_MANAGE,
    ]) {
        assert.ok(!instructor.includes(permission), `an instructor must not hold ${permission}`);
    }
});

test('the audience follows the approved split of the boundary', () => {
    assert.equal(audienceForRole(Role.STUDENT), 'learner');
    assert.equal(audienceForRole(Role.INSTRUCTOR), 'learner');
    assert.equal(audienceForRole(Role.COURSE_MANAGER), 'admin');
    assert.equal(audienceForRole(Role.FINANCE), 'admin');
    assert.equal(audienceForRole(Role.ADMIN), 'admin');
});

// --- 2. token stamping ------------------------------------------------------

function authWith(prisma: any, sign?: (payload: any) => string) {
    const cache = { invalidate: async () => { }, findActiveUser: async () => null };
    return new AuthService(
        prisma as never,
        { sign: sign ?? (() => 'tok') } as never,
        {} as never,
        {} as never,
        cache as never,
    );
}

test('a login token carries the boundary audience and the permission grant', async () => {
    let signed: any = null;
    const auth = authWith({ refreshToken: { create: async () => ({}) } }, (payload) => { signed = payload; return 'at'; });

    await (auth as any).issueTokens('u1', 'a@b.test', Role.ADMIN, 5);

    assert.equal(signed.sub, 'u1');
    assert.equal(signed.tv, 5, 'the revocation claim must survive the new claims');
    assert.equal(signed.aud, 'admin');
    assert.ok(signed.permissions.includes(PERMISSIONS.AUDIT_READ));
    assert.equal(new Set(signed.permissions).size, ALL_PERMISSIONS.length);
});

test('a student token is stamped learner with no permissions', async () => {
    let signed: any = null;
    const auth = authWith({ refreshToken: { create: async () => ({}) } }, (payload) => { signed = payload; return 'at'; });

    await (auth as any).issueTokens('u1', 'a@b.test', Role.STUDENT, 0);

    assert.equal(signed.aud, 'learner');
    assert.deepEqual(signed.permissions, []);
});

test('refresh issues the same claims login does', async () => {
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
            create: async () => ({}),
        },
        user: { findUnique: async () => ({ id: 'u1', email: 'a@b.test', role: Role.FINANCE, isActive: true, tokenVersion: 3, twoFactorEnabled: true }) },
        $transaction: async (ops: any[]) => Promise.all(ops),
    };

    const auth = authWith(prisma, (payload) => { signed = payload; return 'newtok'; });
    await auth.refresh('raw');

    assert.equal(signed.tv, 3, 'the revocation claim must survive the new claims');
    assert.equal(signed.aud, 'admin');
    assert.ok(signed.permissions.includes(PERMISSIONS.FINANCE_WRITE));
    assert.ok(!signed.permissions.includes(PERMISSIONS.AUDIT_READ), 'refresh must not mint a broader grant than the role holds');
});

// --- 3. the strategy --------------------------------------------------------

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

test('permissions come from the database role, not from the token claim', async () => {
    const user = await strategyFor({ ...dbUser, role: Role.FINANCE }).validate({
        sub: 'u1',
        tv: 3,
        aud: 'admin',
        permissions: [PERMISSIONS.USERS_DELETE, PERMISSIONS.AUDIT_READ],
    });

    assert.ok(user.permissions.includes(PERMISSIONS.FINANCE_WRITE), 'the current role grants the money');
    assert.ok(!user.permissions.includes(PERMISSIONS.USERS_DELETE), 'a privileged claim inside the token must be ignored');
    assert.ok(!user.permissions.includes(PERMISSIONS.AUDIT_READ), 'a privileged claim inside the token must be ignored');
    assert.equal(user.audience, 'admin');
});

test('a demotion is visible on the next request although the token still says admin', async () => {
    const user = await strategyFor({ ...dbUser, role: Role.STUDENT }).validate({
        sub: 'u1',
        tv: 3,
        role: Role.ADMIN,
        aud: 'admin',
        permissions: ALL_PERMISSIONS,
    });

    assert.equal(user.role, Role.STUDENT, 'the row wins over the claim');
    assert.deepEqual(user.permissions, []);
    assert.equal(user.audience, 'learner');
});

test('a token minted before the aud/permissions claims still works', async () => {
    const user = await strategyFor(dbUser).validate({ sub: 'u1', tv: 3 });

    assert.equal(user.userId, 'u1', 'deploying the claims must not log anyone out');
    assert.deepEqual(user.permissions, []);
    assert.equal(user.audience, 'learner');
});

test('SECURITY: a 2FA challenge token cannot be used as an access token', async () => {
    await assert.rejects(
        () => strategyFor(dbUser).validate({ sub: 'u1', tv: 3, purpose: '2fa' }),
        /access token/,
        'the token issued to satisfy 2FA must never bypass 2FA',
    );
});

test('SECURITY: a forced-password-change token is not an access token either', async () => {
    await assert.rejects(
        () => strategyFor(dbUser).validate({ sub: 'u1', tv: 3, purpose: 'pwd_change' }),
        /access token/,
    );
});

test('SECURITY: an operations grant is not an access token', async () => {
    await assert.rejects(
        () => strategyFor(dbUser).validate({ sub: 'u1', tv: 3, opsGrant: true, kv: 1 }),
        /access token/,
    );
});

// --- 4. PermissionsGuard ----------------------------------------------------

function contextFor(handler: any, user?: any) {
    return {
        getHandler: () => handler,
        getClass: () => class Route { },
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as never;
}

function handlerRequiring(...permissions: string[]) {
    const handler = function route() { };
    Reflect.defineMetadata(PERMISSIONS_KEY, permissions, handler);
    return handler;
}

test('a route that declares no permission is not stopped by the guard', () => {
    const guard = new PermissionsGuard(new Reflector());
    assert.equal(guard.canActivate(contextFor(function route() { })), true);
});

test('holding the declared permission is enough', () => {
    const guard = new PermissionsGuard(new Reflector());
    const handler = handlerRequiring(PERMISSIONS.AUDIT_READ);

    assert.equal(guard.canActivate(contextFor(handler, {
        role: Role.ADMIN,
        permissions: permissionsForRole(Role.ADMIN),
    })), true);
});

test('SECURITY: lacking the declared permission is denied', () => {
    const guard = new PermissionsGuard(new Reflector());
    const handler = handlerRequiring(PERMISSIONS.AUDIT_READ);

    assert.throws(
        () => guard.canActivate(contextFor(handler, {
            role: Role.COURSE_MANAGER,
            permissions: permissionsForRole(Role.COURSE_MANAGER),
        })),
        /audit:read/,
    );
});

test('SECURITY: a declared requirement with no authenticated user fails closed', () => {
    const guard = new PermissionsGuard(new Reflector());
    const handler = handlerRequiring(PERMISSIONS.AUDIT_READ);

    assert.throws(() => guard.canActivate(contextFor(handler, undefined)), /could not be resolved/);
    assert.throws(() => guard.canActivate(contextFor(handler, { role: Role.ADMIN })), /could not be resolved/);
});

// --- 5. AdminBoundaryGuard --------------------------------------------------

function boundaryContext(pathname: string, authorization?: string) {
    return {
        switchToHttp: () => ({
            getRequest: () => ({
                path: pathname,
                url: pathname,
                headers: authorization ? { authorization } : {},
            }),
        }),
    } as never;
}

test('the boundary touches only admin-prefixed paths', () => {
    const guard = new AdminBoundaryGuard();

    assert.equal(guard.canActivate(boundaryContext('/support-tickets/my')), true);
    assert.equal(guard.canActivate(boundaryContext('/api/learner/courses')), true);
    // An existing endpoint whose path merely ends in "admin": the prefix rule
    // must not swallow it.
    assert.equal(guard.canActivate(boundaryContext('/enrollments/admin')), true);
    // A path that merely contains "admin" as a later segment is also left alone.
    assert.equal(guard.canActivate(boundaryContext('/health/admin/stats')), true);
});

test('SECURITY: an admin path with no token is refused', () => {
    const guard = new AdminBoundaryGuard();

    assert.throws(() => guard.canActivate(boundaryContext('/admin/users')), /requires authentication/);
    assert.throws(() => guard.canActivate(boundaryContext('/api/admin/users')), /requires authentication/);
    assert.throws(() => guard.canActivate(boundaryContext('/admin')), /requires authentication/);
    // The moved Phase 3 routes: both spellings the boundary covers.
    assert.throws(() => guard.canActivate(boundaryContext('/admin/stats')), /requires authentication/);
    assert.throws(() => guard.canActivate(boundaryContext('/api/admin/audit')), /requires authentication/);
});

test('SECURITY: a learner-audience token is refused on an admin path', () => {
    const guard = new AdminBoundaryGuard();
    const token = jwt.sign({ sub: 'u1', aud: 'learner' }, SECRET, { algorithm: 'HS256', expiresIn: '5m' });

    assert.throws(
        () => guard.canActivate(boundaryContext('/admin/users', `Bearer ${token}`)),
        /admin-audience/,
    );
});

test('an admin-audience token is accepted on an admin path', () => {
    const guard = new AdminBoundaryGuard();
    const token = jwt.sign({ sub: 'u1', aud: 'admin' }, SECRET, { algorithm: 'HS256', expiresIn: '5m' });

    assert.equal(guard.canActivate(boundaryContext('/admin/users', `Bearer ${token}`)), true);
    assert.equal(guard.canActivate(boundaryContext('/api/admin/users', `Bearer ${token}`)), true);
});

test('SECURITY: a token signed with another key is refused', () => {
    const guard = new AdminBoundaryGuard();
    const forged = jwt.sign({ sub: 'u1', aud: 'admin' }, 'attacker-secret', { algorithm: 'HS256' });

    assert.throws(() => guard.canActivate(boundaryContext('/admin/users', `Bearer ${forged}`)), /Invalid admin token/);
});

test('SECURITY: an expired admin token is refused', () => {
    const guard = new AdminBoundaryGuard();
    const expired = jwt.sign({ sub: 'u1', aud: 'admin' }, SECRET, { algorithm: 'HS256', expiresIn: -10 });

    assert.throws(() => guard.canActivate(boundaryContext('/admin/users', `Bearer ${expired}`)), /Invalid admin token/);
});

test('SECURITY: a purpose token is refused even if it claims the admin audience', () => {
    const guard = new AdminBoundaryGuard();
    const challenge = jwt.sign({ sub: 'u1', aud: 'admin', purpose: '2fa' }, SECRET, { algorithm: 'HS256' });

    assert.throws(() => guard.canActivate(boundaryContext('/admin/users', `Bearer ${challenge}`)), /access token/);
});

// --- 6. wiring --------------------------------------------------------------

function walkSources(dir: string): string[] {
    const entries = fs.readdirSync(dir, { recursive: true }) as string[];
    return entries
        .map((entry) => path.join(dir, entry))
        .filter((file) => file.endsWith('.ts') && fs.statSync(file).isFile());
}

test('every file using @RequirePermissions also registers PermissionsGuard', () => {
    const files = walkSources(path.join(process.cwd(), 'src'));
    const annotated = files.filter((file) => fs.readFileSync(file, 'utf8').includes('@RequirePermissions('));

    assert.ok(annotated.length > 0, 'the decorator should already be in use');
    for (const file of annotated) {
        assert.ok(
            fs.readFileSync(file, 'utf8').includes('PermissionsGuard'),
            `${path.relative(process.cwd(), file)} declares a permission but never registers the guard that enforces it`,
        );
    }
});

test('the boundary guard is registered as a global guard', () => {
    const appModule = fs.readFileSync(path.join(process.cwd(), 'src', 'app.module.ts'), 'utf8');

    assert.match(appModule, /useClass:\s*AdminBoundaryGuard/);
});
