import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

/**
 * Phase 3 of the boundary split: the admin surface lives at /api/admin/* and
 * every one of its routes is permission-checked, while learner/public callers
 * keep their old paths. Both halves rot silently if left to review alone:
 *
 *  A. A new route added to an admin controller without @RequirePermissions
 *     would be guarded only by the class-level list check -- i.e. not at all
 *     once Roles are granted, and the count check below is what notices.
 *  B. A frontend call still pointing at a moved route's old path dies as a
 *     404 the moment the old handler stops existing, so every literal call
 *     site is classified: moved families must appear only under /api/admin,
 *     except the handful of learner routes that stayed put (operations
 *     beacon, coupon validation, public gateway/blog lists, ...).
 */

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const FRONTEND = join(ROOT, 'frontend', 'src');

function walk(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...walk(full));
        else found.push(full);
    }
    return found;
}

// --- A. backend: every api/admin route is permission-checked ----------------

const EXPECTED_ADMIN_CONTROLLERS = [
    'src/announcement-board/admin-announcement-board.controller.ts',
    'src/audit/audit.controller.ts',
    'src/blog/admin-blog.controller.ts',
    'src/courses/admin-courses.controller.ts',
    'src/finance/admin-finance.controller.ts',
    'src/gamification/admin-gamification.controller.ts',
    'src/instructor-applications/admin-instructor-applications.controller.ts',
    'src/operations/admin-operations.controller.ts',
    'src/payment-gateways/admin-payment-gateways.controller.ts',
    'src/support-tickets/admin-support-tickets.controller.ts',
];

const adminControllers = walk(SRC)
    .filter((f) => f.endsWith('.controller.ts'))
    .filter((f) => /@Controller\('api\/admin/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));

test('every admin-pure family has its /api/admin controller', () => {
    for (const expected of EXPECTED_ADMIN_CONTROLLERS) {
        assert.ok(adminControllers.includes(expected), `${expected} no longer serves an /api/admin route`);
    }
    // Discovery itself must not be vacuous.
    assert.ok(adminControllers.length >= EXPECTED_ADMIN_CONTROLLERS.length, 'admin controller discovery found too little');
});

test('SECURITY: every route in an api/admin controller carries @RequirePermissions', () => {
    for (const rel of adminControllers) {
        const src = readFileSync(join(ROOT, rel), 'utf8');
        const routes = src.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? [];
        const permissions = src.match(/@RequirePermissions\(/g) ?? [];
        assert.equal(
            permissions.length,
            routes.length,
            `${rel}: ${routes.length} routes but ${permissions.length} @RequirePermissions decorators -- ` +
            'a route without a permission check falls back to Roles alone',
        );
        assert.ok(src.includes('PermissionsGuard'), `${rel} does not mount PermissionsGuard`);
        assert.ok(src.includes('JwtAuthGuard'), `${rel} does not mount JwtAuthGuard`);
    }
});

test('the boundary-matched health admin route is permission-checked in place', () => {
    // /admin/stats never moves (AdminBoundaryGuard already matches it), so the
    // annotation lives in the original controller instead of an api/admin file.
    const src = readFileSync(join(SRC, 'health', 'health.controller.ts'), 'utf8');
    assert.ok(/@RequirePermissions\(PERMISSIONS\.SYSTEM_READ\)/.test(src), 'admin/stats lost its permission');
    assert.ok(src.includes('PermissionsGuard'), 'health controller lost PermissionsGuard');
    assert.ok(/@Get\('admin\/stats'\)/.test(src), 'admin/stats route path changed unexpectedly');
});

// --- B. frontend: no call site still targets a moved old path ---------------

interface CallSite {
    file: string;
    line: number;
    method: string;
    path: string;
}

/** Cut query strings and template interpolations: classification only needs
 *  the static prefix of the path. Returns null for non-absolute literals. */
function normalizePath(raw: string): string | null {
    let p = raw;
    const interp = p.indexOf('${');
    if (interp >= 0) p = p.slice(0, interp);
    const query = p.indexOf('?');
    if (query >= 0) p = p.slice(0, query);
    if (!p.startsWith('/') || p === '/') return null;
    return p;
}

function lineOf(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
}

function extractCalls(file: string, content: string): CallSite[] {
    const sites: CallSite[] = [];
    const push = (method: string, rawPath: string, index: number) => {
        const path = normalizePath(rawPath);
        if (path) sites.push({ file, line: lineOf(content, index), method: method.toUpperCase(), path });
    };

    // api.get('/x') / api.post<Foo>('/x') / api.patch(`/x/${id}`)
    for (const m of content.matchAll(
        /\bapi\.(get|post|put|patch|delete)(?:<[\s\S]{0,120}?>)?\(\s*(['"`])([^'"`\n]*)\2/g,
    )) {
        push(m[1], m[3], m.index ?? 0);
    }

    // useFetchData<T>('/x') and downloadProtectedFile('/x') are always GETs.
    for (const pattern of [
        /\buseFetchData(?:<[\s\S]{0,160}?>)?\(\s*(['"`])([^'"`\n]*)\1/g,
        /\bdownloadProtectedFile(?:<[\s\S]{0,160}?>)?\(\s*(['"`])([^'"`\n]*)\1/g,
    ]) {
        for (const m of content.matchAll(pattern)) push('get', m[2], m.index ?? 0);
    }

    // Raw fetch against the REST origin: fetch(`${API_BASE_URL}/path`)
    for (const m of content.matchAll(/fetch\(\s*(['"`])\$\{(?:API_BASE_URL|API_URL)\}([^'"`\n]*)\1/g)) {
        push('get', m[2], m.index ?? 0);
    }

    // navigator.sendBeacon(`${ORIGIN}/operations/track`, ...) is a POST.
    for (const m of content.matchAll(/\bsendBeacon\(([\s\S]*?),\s*new Blob/g)) {
        const path = m[1].match(/['"}]\s*(\/[A-Za-z][^`'"()\s,]*)/);
        if (path) push('post', path[1], m.index ?? 0);
    }

    return sites;
}

/**
 * A call is a violation when it targets a family that moved, at its OLD
 * location, and is not one of the learner/public routes that deliberately
 * stayed behind. Everything outside the moved families is out of scope here.
 */
function isViolation(method: string, path: string): string | null {
    if (path.startsWith('/api/admin/')) return null;
    const m = method.toUpperCase();

    if (path === '/audit' || path.startsWith('/audit/')) return 'audit moved wholesale';

    if (path === '/finance' || path.startsWith('/finance/')) {
        return m === 'POST' && path === '/finance/coupons/validate' ? null : 'finance admin routes moved';
    }
    if (path === '/operations' || path.startsWith('/operations/')) {
        return m === 'POST' && path === '/operations/track' ? null : 'operations admin routes moved';
    }
    if (path === '/support-tickets' || path.startsWith('/support-tickets/')) {
        if (m === 'GET' && path.startsWith('/support-tickets/my')) return null;
        if (m === 'POST' && path === '/support-tickets') return null;
        return 'support-ticket admin routes moved';
    }
    if (path === '/announcement-board' || path.startsWith('/announcement-board/')) {
        return m === 'GET' && path === '/announcement-board/active' ? null : 'announcement admin routes moved';
    }
    if (path === '/payment-gateways' || path.startsWith('/payment-gateways/')) {
        return m === 'GET' && path === '/payment-gateways' ? null : 'gateway admin routes moved';
    }
    if (path === '/instructor-applications' || path.startsWith('/instructor-applications/')) {
        if (m === 'GET' && path.startsWith('/instructor-applications/my')) return null;
        if (m === 'POST' && path === '/instructor-applications') return null;
        return 'application admin routes moved';
    }
    if (path === '/gamification' || path.startsWith('/gamification/')) {
        if (m === 'GET') return null;
        return m === 'POST' && path === '/gamification/track' ? null : 'gamification admin routes moved';
    }
    if (path === '/blog' || path.startsWith('/blog/')) {
        return m === 'GET' ? null : 'blog admin routes moved';
    }
    if (path === '/courses' || path.startsWith('/courses/')) {
        return m === 'GET' ? null : 'course mutations moved';
    }
    return null;
}

const frontendSites: CallSite[] = [];
for (const file of walk(FRONTEND)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    if (file.includes('node_modules')) continue;
    const content = readFileSync(file, 'utf8');
    frontendSites.push(...extractCalls(relative(ROOT, file), content));
}

test('frontend API call extraction finds the call sites', () => {
    // Vacuous extraction would make every assertion below pass for the wrong
    // reason; the app has well over a hundred literal calls.
    assert.ok(frontendSites.length > 100, `only ${frontendSites.length} call sites extracted`);
});

test('SECURITY: no frontend call targets a moved route at its old path', () => {
    const violations = frontendSites
        .filter((s) => isViolation(s.method, s.path))
        .map((s) => `${s.file}:${s.line} ${s.method} ${s.path} -> ${isViolation(s.method, s.path)}`);
    assert.deepEqual(violations, [], `calls still aimed at pre-split paths:\n${violations.join('\n')}`);
});

test('frontend calls every moved family at its new /api/admin path', () => {
    const required = [
        '/api/admin/audit',
        '/api/admin/operations/',
        '/api/admin/finance/coupons',
        '/api/admin/support-tickets',
        '/api/admin/announcement-board',
        '/api/admin/payment-gateways',
        '/api/admin/instructor-applications',
        '/api/admin/blog',
        '/api/admin/courses',
    ];
    const missing = required.filter(
        (prefix) => !frontendSites.some((s) => s.path.startsWith(prefix)),
    );
    assert.deepEqual(missing, [], `these moved families are never called at their new path:\n${missing.join('\n')}`);
});
