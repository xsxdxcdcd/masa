import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { UsersService } from '../src/users/users.service';

/**
 * Deleting a user that other rows still point at must say so.
 *
 * `Enrollment.student`, `Course.instructor` and `CourseOpening.instructor` all
 * declare `onDelete: Restrict` on purpose: a student's payment history and an
 * instructor's course cannot vanish with the account. The refusal is correct, but
 * a bare `prisma.user.delete` let Prisma's `P2003` escape, and the global filter
 * turned it into a 500. An admin deleting any student who has ever enrolled saw
 * a server fault and no reason at all. A 409 naming the constraint is the whole
 * difference between "the platform is broken" and "this account has history".
 */

const P2003 = (field = 'Enrollment_studentId_fkey (required)') =>
    new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
        meta: { field_name: field },
    });

/**
 * What Postgres 23001 actually looks like once it reaches the service, copied
 * from the deployment log. Note the `\"` around the constraint name: the engine
 * renders the Postgres error with Rust's `Debug`, so the inner quotes come back
 * escaped. A regex that assumes plain `"` matches nothing here and silently
 * degrades the message to the generic one.
 */
const RESTRICT = (table = 'Enrollment', constraint = 'Enrollment_studentId_fkey') =>
    new Prisma.PrismaClientUnknownRequestError(
        'Invalid `prisma.user.delete()` invocation:\n\n' +
            'Error occurred during query execution:\n' +
            'ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "23001", ' +
            `message: "update or delete on table \\"User\\" violates RESTRICT setting of foreign key ` +
            `constraint \\"${constraint}\\" on table \\"${table}\\"", severity: "ERROR", ` +
            `detail: Some("Key (id)=(abc) is referenced from table \\"${table}\\"."), ` +
            'column: None, hint: None }), transient: false })',
        { clientVersion: '5.0.0' },
    );

const build = (impl: (args: any) => Promise<any>) => {
    const prisma = { user: { delete: impl } };
    const audit = { logAction: async () => {} };
    const invalidated: string[] = [];
    const cache = { invalidate: async (id: string) => { invalidated.push(id); } };
    return { service: new UsersService(prisma as never, audit as never, cache as never), invalidated };
};

describe('admin user deletion explains a relational-integrity refusal', () => {
    test('a referenced user answers 409, never 500', async () => {
        const { service: svc } = build(async () => { throw P2003(); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.equal(err.getStatus?.(), 409);
                assert.equal(err.response?.code, 'USER_HAS_REFERENCING_RECORDS');
                assert.match(err.response?.message, /cannot be deleted/i);
                return true;
            },
        );
    });

    test('the refusal names the table that is holding the row', async () => {
        const { service: svc } = build(async () => { throw P2003('Enrollment_studentId_fkey (required)'); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.deepEqual(err.response?.references, ['Enrollment_studentId_fkey (required)']);
                return true;
            },
        );
    });

    test('the refusal survives a constraint that reports no field name', async () => {
        const { service: svc } = build(async () => {
            throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '5.0.0',
                meta: {},
            });
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.equal(err.getStatus?.(), 409);
                assert.deepEqual(err.response?.references, []);
                return true;
            },
        );
    });

    test('an unknown id answers 404 instead of 500', async () => {
        const { service: svc } = build(async () => {
            throw new Prisma.PrismaClientKnownRequestError('Record to delete does not exist', {
                code: 'P2025',
                clientVersion: '5.0.0',
            });
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => err.getStatus?.() === 404,
        );
    });

    test('a deletable user is still deleted', async () => {
        let deleted = false;
        const { service: svc } = build(async () => { deleted = true; return { id: 'u1' }; });
        const row = await svc.remove('u1', 'admin-1');
        assert.equal(deleted, true);
        assert.equal(row.id, 'u1');
    });

    test('an unrelated failure is not swallowed into a 409', async () => {
        const { service: svc } = build(async () => { throw new Error('connection reset'); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => !(err.getStatus?.() === 409),
        );
    });
});

/**
 * The production shape of the failure, captured from the deployment log:
 *
 *   PostgresError { code: "23001", message: "update or delete on table "User"
 *   violates RESTRICT setting of foreign key constraint
 *   "Enrollment_studentId_fkey" on table "Enrollment"" }
 *   → PrismaClientUnknownRequestError
 *
 * Not `PrismaClientKnownRequestError`, and therefore not `P2003`. A handler that
 * only watches for `P2003` compiles, passes a test written against a synthetic
 * P2003, and still returns 500 against the real database.
 */
describe('the refusal survives the spelling Postgres actually uses', () => {
    test('a RESTRICT violation answers 409, not 500', async () => {
        const { service: svc } = build(async () => { throw RESTRICT(); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.equal(err.getStatus?.(), 409);
                assert.equal(err.response?.code, 'USER_HAS_REFERENCING_RECORDS');
                return true;
            },
        );
    });

    test('the message names the table that is holding the row', async () => {
        const { service: svc } = build(async () => { throw RESTRICT(); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.match(err.response?.message, /Enrollment records still reference/);
                assert.deepEqual(err.response?.references, ['Enrollment_studentId_fkey']);
                return true;
            },
        );
    });

    test('an instructor blocked by Course reads as Course, not Enrollment', async () => {
        const { service: svc } = build(async () => {
            throw RESTRICT('Course', 'Course_instructorId_fkey');
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.match(err.response?.message, /Course records still reference/);
                return true;
            },
        );
    });

    test('a plain foreign-key violation with no constraint name still answers 409', async () => {
        const { service: svc } = build(async () => {
            throw new Prisma.PrismaClientUnknownRequestError(
                'Error occurred during query execution:\nupdate or delete on table "User" violates foreign key constraint',
                { clientVersion: '5.0.0' },
            );
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.equal(err.getStatus?.(), 409);
                assert.deepEqual(err.response?.references, []);
                return true;
            },
        );
    });

    test('an unknown-request error that is not a key violation is not translated', async () => {
        const { service: svc } = build(async () => {
            throw new Prisma.PrismaClientUnknownRequestError('division by zero', { clientVersion: '5.0.0' });
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => !(err.getStatus?.() === 409),
        );
    });

    test('an unescaped constraint name is read too', async () => {
        const { service: svc } = build(async () => {
            throw new Prisma.PrismaClientUnknownRequestError(
                'violates RESTRICT setting of foreign key constraint "Course_instructorId_fkey" on table "Course"',
                { clientVersion: '5.0.0' },
            );
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.deepEqual(err.response?.references, ['Course_instructorId_fkey']);
                assert.match(err.response?.message, /Course records still reference/);
                return true;
            },
        );
    });
});
