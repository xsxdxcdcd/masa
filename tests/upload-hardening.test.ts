import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { bodyParserErrorHandler } from '../src/common/body-parser-error.middleware';

/**
 * Two small guarantees, both easy to undo by accident.
 *
 * 1. Every upload endpoint caps fieldSize. fileSize alone does not help: a
 *    non-file multipart field is buffered in memory, so an attacker can exhaust
 *    the heap without writing a single byte to the 500MB volume. fileSize limits
 *    the file, not the fields around it.
 *
 * 2. body-parser complaints are normalised. Nest re-wraps a JSON SyntaxError
 *    into a BadRequestException, so AllExceptionsFilter cannot tell it apart
 *    from a message the app meant to send -- which is how V8's parser text
 *    reached anonymous callers.
 */

const SRC = join(__dirname, '..', 'src');

/**
 * Every controller that mounts a FileInterceptor, discovered from the source
 * rather than listed by hand: when an upload endpoint moves to a new file (as
 * the Phase 3 admin split did), the guarantee has to follow it automatically.
 */
function uploadControllers(dir: string = SRC): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...uploadControllers(full));
        } else if (entry.name.endsWith('.controller.ts') && /FileInterceptor/.test(readFileSync(full, 'utf8'))) {
            found.push(relative(SRC, full));
        }
    }
    return found;
}

const UPLOAD_CONTROLLERS = uploadControllers();

test('SECURITY: every upload endpoint caps fieldSize as well as fileSize', () => {
    // The discovery itself must work: an empty list would make every assertion
    // below vacuous.
    assert.ok(UPLOAD_CONTROLLERS.length > 0, 'no controller with FileInterceptor was discovered under src/');
    const missing: string[] = [];
    for (const rel of UPLOAD_CONTROLLERS) {
        const src = readFileSync(join(SRC, rel), 'utf8');
        // Each multer interceptor owns a limits: {...} block.
        const blocks = src.match(/limits:\s*\{[^}]*\}/gs) ?? [];
        if (blocks.length === 0) {
            missing.push(`${rel} (no limits block found)`);
            continue;
        }
        for (const block of blocks) {
            if (!/fieldSize\s*:/.test(block)) {
                missing.push(`${rel} -> ${block.replace(/\s+/g, ' ').trim()}`);
            }
        }
    }
    assert.deepEqual(missing, [], `these limits blocks allow unbounded form fields:\n${missing.join('\n')}`);
});

test('SECURITY: fieldSize is small enough to be a real cap', () => {
    for (const rel of UPLOAD_CONTROLLERS) {
        const src = readFileSync(join(SRC, rel), 'utf8');
        // Match only the expression up to the next comma. A looser pattern
        // swallows the properties that follow and reports nonsense.
        for (const [, expr] of src.matchAll(/fieldSize:\s*([0-9_ *]+),/g)) {
            const bytes = Function(`"use strict"; return (${expr.trim()})`)() as number;
            assert.ok(
                bytes <= 2 * 1024 * 1024,
                `${rel} sets fieldSize to ${bytes} bytes, which is not a meaningful cap`,
            );
        }
    }
});

test('SECURITY: no upload endpoint relies on fileSize alone', () => {
    for (const rel of UPLOAD_CONTROLLERS) {
        const src = readFileSync(join(SRC, rel), 'utf8');
        for (const block of src.match(/limits:\s*\{[^}]*\}/gs) ?? []) {
            assert.ok(
                /fields\s*:/.test(block),
                `${rel} caps files but not the number of fields: ${block.replace(/\s+/g, ' ')}`,
            );
        }
    }
});

// --- body parser normalisation -------------------------------------------

function runMiddleware(err: any) {
    let status = 0;
    let body: any;
    const res = { status(c: number) { status = c; return this; }, json(b: any) { body = b; return this; } };
    let passedOn = false;
    const next = () => { passedOn = true; };
    bodyParserErrorHandler(err, {} as any, res as any, next);
    return { status, body, passedOn };
}

test('a JSON syntax error loses the parser wording', () => {
    const err = Object.assign(new SyntaxError("Expected property name or '}' in JSON at position 1"), {
        type: 'entity.parse.failed',
        status: 400,
    });
    const r = runMiddleware(err);

    assert.equal(r.status, 400);
    assert.equal(r.passedOn, false, 'the response is written here, not deferred');
    assert.ok(!/position 1/.test(JSON.stringify(r.body)), 'V8 wording must not reach the caller');
    assert.equal(r.body.message, 'Request body could not be parsed');
});

test('an oversized body keeps its 413', () => {
    const err = Object.assign(new Error('request entity too large'), {
        type: 'entity.too.large',
        status: 413,
    });
    const r = runMiddleware(err);

    assert.equal(r.status, 413);
    assert.ok(!/too large/i.test(JSON.stringify(r.body)) || /body is too large/i.test(r.body.message));
    assert.ok(!/request entity too large/.test(r.body.message), 'library wording must be replaced');
});

test('an unrelated error is passed on untouched', () => {
    const err = new Error('something else entirely');
    const r = runMiddleware(err);

    assert.equal(r.passedOn, true, 'the exception filter still needs to see it');
    assert.equal(r.status, 0, 'and nothing was written');
});
