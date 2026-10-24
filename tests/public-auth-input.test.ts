import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync, getMetadataStorage } from 'class-validator';
import { ForgotPasswordDto } from '../src/auth/dto/forgot-password.dto';
import { RefreshTokenDto } from '../src/auth/dto/refresh-token.dto';
import { VerifyEmailDto } from '../src/auth/dto/verify-email.dto';

/**
 * The public, unauthenticated auth endpoints must never answer 5xx.
 *
 * Each took its single field straight off `@Body('field')`, so a missing or
 * non-string value arrived as `undefined` and reached `crypto.createHash(...).update(undefined)`
 * or `prisma.user.findUnique({ where: { email: undefined } })`. Node throws a
 * TypeError there, the exception filter answers 500, and because none of these
 * routes require a token anyone could fill the error log at will. ValidationPipe
 * turns that into the same 400 the sibling endpoints already return.
 */

const errorsFor = (cls: any, payload: unknown): string[] =>
    validateSync(plainToInstance(cls, payload)).flatMap((e: any) => Object.values(e.constraints ?? {}) as string[]);

const cases: { name: string; cls: any; good: Record<string, unknown>; bad: { label: string; body: unknown }[] }[] = [
    {
        name: 'POST /auth/verify-email',
        cls: VerifyEmailDto,
        good: { token: 'a'.repeat(64) },
        bad: [
            { label: 'no body at all', body: {} },
            { label: 'a numeric token', body: { token: 123 } },
            { label: 'a null token', body: { token: null } },
            { label: 'an array token', body: { token: ['x'] } },
        ],
    },
    {
        name: 'POST /auth/forgot-password',
        cls: ForgotPasswordDto,
        good: { email: 'user@example.com' },
        bad: [
            { label: 'no body at all', body: {} },
            { label: 'a numeric email', body: { email: 5 } },
            { label: 'an address with no @', body: { email: 'not-an-email' } },
        ],
    },
    {
        name: 'POST /auth/refresh',
        cls: RefreshTokenDto,
        good: { refreshToken: 'r'.repeat(48) },
        bad: [
            { label: 'no body at all', body: {} },
            { label: 'an empty token', body: { refreshToken: '' } },
            { label: 'an object token', body: { refreshToken: { a: 1 } } },
        ],
    },
];

describe('public auth endpoints reject malformed input instead of crashing', () => {
    for (const { name, cls, good, bad } of cases) {
        test(`${name} accepts a well-formed payload`, () => {
            assert.deepEqual(errorsFor(cls, good), [], 'a valid request must not be rejected');
        });

        for (const { label, body } of bad) {
            test(`${name} answers 400 for ${label}`, () => {
                assert.ok(
                    errorsFor(cls, body).length > 0,
                    `expected a validation error so ValidationPipe returns 400 instead of a 500`,
                );
            });
        }
    }

    test('every field the controller reads carries a validation rule', () => {
        // The bug was a bare `@Body('field')` reaching the service as
        // `undefined`, so what matters is that the DTO still constrains exactly
        // the fields the handler passes through — a future rename cannot quietly
        // drop the guard.
        const storage = getMetadataStorage();
        for (const { name, cls, good } of cases) {
            const ruled = storage
                .getTargetValidationMetadatas(cls, cls.name, true, false)
                .map((m) => m.propertyName);
            assert.deepEqual([...new Set(ruled)].sort(), Object.keys(good).sort(), `${name} rules the wrong fields`);
        }
    });

    test('the rules reject the missing value rather than passing it through', () => {
        for (const { name, cls } of cases) {
            for (const field of fieldsOf(cls)) {
                assert.ok(
                    errorsFor(cls, { [field]: undefined }).length > 0,
                    `${name}.${field} must fail when the field is absent`,
                );
            }
        }
    });
});

function fieldsOf(cls: any): string[] {
    const storage = getMetadataStorage();
    return [...new Set(storage.getTargetValidationMetadatas(cls, cls.name, true, false).map((m) => m.propertyName))];
}
