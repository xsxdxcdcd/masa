import test from 'node:test';
import assert from 'node:assert/strict';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import {
    HttpException,
    BadRequestException,
    UnauthorizedException,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
    HttpStatus,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

/**
 * Every uncaught error now passes through this filter, so the tests are about
 * two things that pull against each other:
 *
 *   - nothing internal leaks to an anonymous caller
 *   - nothing the application deliberately said gets swallowed
 *
 * The second one matters just as much. The frontend reads validation failures
 * as an ARRAY of field messages; if this filter flattened that into a string,
 * every form in the product would silently stop explaining itself.
 */

function hostFor(overrides: Partial<any> = {}) {
    let statusCode = 0;
    let payload: any;
    const res = {
        headersSent: false,
        status(code: number) { statusCode = code; return this; },
        json(body: any) { payload = body; return this; },
    };
    const req = {
        method: 'POST',
        originalUrl: '/auth/login',
        headers: {},
        ...overrides,
    };
    const host = {
        switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
    } as unknown as ArgumentsHost;
    return { host, res, body: () => payload, status: () => statusCode };
}

const filter = new AllExceptionsFilter();

function run(exception: unknown, overrides: Partial<any> = {}) {
    const h = hostFor(overrides);
    filter.catch(exception, h.host);
    return { status: h.status(), body: h.body() };
}

// --- what the app said on purpose must survive -----------------------------

test('a deliberate 401 keeps its message', () => {
    const r = run(new UnauthorizedException('Invalid credentials'));
    assert.equal(r.status, 401);
    assert.equal(r.body.message, 'Invalid credentials');
});

test('a 404 keeps its message', () => {
    const r = run(new NotFoundException('User not found'));
    assert.equal(r.status, 404);
    assert.equal(r.body.message, 'User not found');
});

test('a 403 keeps its message', () => {
    const r = run(new ForbiddenException('Not your batch'));
    assert.equal(r.status, 403);
    assert.equal(r.body.message, 'Not your batch');
});

test('CRITICAL: a validation error stays an ARRAY, or every form stops explaining itself', () => {
    const original = new BadRequestException({
        message: ['email must be an email', 'password should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
    });
    const r = run(original);

    assert.equal(r.status, 400);
    assert.ok(Array.isArray(r.body.message), 'the frontend iterates this list');
    assert.deepEqual(r.body.message, ['email must be an email', 'password should not be empty']);
});

test('an explicit 500 HttpException still yields a generic message', () => {
    // Some code throws InternalServerErrorException('db password is hunter2').
    // A caller must not get that, even though it is technically an HttpException.
    const r = run(new InternalServerErrorException('db password is hunter2'));
    assert.equal(r.status, 500);
    assert.ok(!/hunter2/.test(JSON.stringify(r.body)), 'server-side detail must not be echoed');
});

test('every response carries a requestId for support to trace', () => {
    const r = run(new NotFoundException('nope'));
    assert.ok(r.body.requestId, 'a requestId is how a 500 becomes findable in the log');
});

test('an inbound x-request-id is reused rather than replaced', () => {
    const r = run(new NotFoundException('nope'), { headers: { 'x-request-id': 'trace-abc-123' } });
    assert.equal(r.body.requestId, 'trace-abc-123');
});

// --- what must NOT reach the caller ---------------------------------------

test('a plain Error yields 500 with no internal text', () => {
    const r = run(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'));
    assert.equal(r.status, 500);
    const dumped = JSON.stringify(r.body);
    assert.ok(!/hunter2/.test(dumped), 'the message must not be echoed');
    assert.ok(!/ECONNREFUSED/.test(dumped), 'nor the internal host and port');
    assert.ok(!/10\.0\.0\.5/.test(dumped));
    assert.equal(r.body.message, 'An unexpected error occurred');
});

test('a stack trace never appears in the response', () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at /usr/src/app/dist/src/secret/path.js:42:9';
    const r = run(err);
    assert.ok(!JSON.stringify(r.body).includes('/usr/src/app'), 'filesystem paths are internal detail');
    assert.ok(!r.body.stack);
});

test('a TypeError from a null dereference is generic', () => {
    const r = run(new TypeError("Cannot read properties of undefined (reading 'passwordHash')"));
    assert.equal(r.status, 500);
    assert.ok(!/passwordHash/.test(JSON.stringify(r.body)));
});

test('a thrown non-Error is still handled', () => {
    const r = run('just a string');
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.body).includes('just a string'));
});

test('a Prisma error code does not escape', () => {
    const r = run(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.body).includes('P2002'));
});

// --- library errors that were leaking verbatim ----------------------------

test('a body-parser JSON syntax error loses V8 wording but keeps 400', () => {
    // This is what production returned before the filter existed:
    //   {"message":"Expected property name or '}' in JSON at position 1"}
    const err = Object.assign(
        new SyntaxError("Expected property name or '}' in JSON at position 1"),
        { status: 400, type: 'entity.parse.failed' },
    );
    const r = run(err);

    assert.equal(r.status, 400);
    assert.ok(!/position 1/.test(JSON.stringify(r.body)), 'the parser message must not be echoed');
});

test('the body-parser 413 keeps its status, loses its wording', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413 });
    const r = run(err);
    assert.equal(r.status, 413);
    assert.ok(!/too large/.test(JSON.stringify(r.body)));
});

test('a multer upload error keeps 4xx and hides disk detail', () => {
    const err = Object.assign(new Error('ENOENT: no such file or directory, open /usr/src/app/uploads/x'), {
        status: 500,
    });
    const r = run(err);
    assert.equal(r.status, 500);
    assert.ok(!/usr\/src\/app/.test(JSON.stringify(r.body)));
});

// --- streaming must not be corrupted --------------------------------------

test('when headers are already sent the filter does not try to rewrite the body', () => {
    const h = hostFor();
    h.res.headersSent = true;
    filter.catch(new Error('late failure'), h.host);
    assert.equal(h.status(), 0, 'no status written');
    assert.equal(h.body(), undefined, 'no body written');
});
