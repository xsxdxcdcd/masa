import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CoursesService } from '../src/courses/courses.service';
import { CertificatesService } from '../src/certificates/certificates.service';
import { Role, CourseOpeningStatus, CertificateStatus } from '@prisma/client';

/**
 * Regression tests for the three issues found in the platform audit:
 *
 *  1. GET /courses and GET /courses/:id are reachable anonymously but filtered
 *     only on isPublished, so they leaked ENDED / STARTED batches (name, price,
 *     headcount) that /public/courses correctly hides.
 *  2. markPrinted recorded who released a certificate but wrote no audit-log row,
 *     unlike issue / revoke / reissue.
 *  3. markPrinted accepted any INSTRUCTOR for any certificate, so a teacher from
 *     an unrelated course could stamp their name as the releaser.
 *
 * The services are exercised directly with a stub Prisma client: these are
 * authorization rules, and the unit of interest is the `where` clause the
 * service hands to Prisma, not Prisma's own behaviour.
 */

const OPEN = CourseOpeningStatus.OPEN;
const ANNOUNCEMENT = CourseOpeningStatus.ANNOUNCEMENT;
const ENDED = CourseOpeningStatus.ENDED;
const STARTED = CourseOpeningStatus.STARTED;

const OPEN_STATUSES = [OPEN, ANNOUNCEMENT];

/** Collects the `where` passed to the openings relation of the last query. */
function makePrismaStub(opts: {
    courseId?: string;
    courseInstructorId?: string | null;
    taughtCourseIds?: string[];
    enrolledCourseIds?: string[];
    certificate?: Record<string, unknown> | null;
    printedAt?: Date | null;
}) {
    const calls: Array<{ model: string; args: any }> = [];
    const taught = opts.taughtCourseIds ?? [];
    const enrolled = opts.enrolledCourseIds ?? [];

    const prisma: any = {
        course: {
            findMany: (args: any) => {
                calls.push({ model: 'course.findMany', args });
                return Promise.resolve([]);
            },
            findUnique: (args: any) => {
                calls.push({ model: 'course.findUnique', args });
                return Promise.resolve(
                    opts.courseInstructorId === undefined && opts.courseId === undefined
                        ? null
                        : { id: opts.courseId, instructorId: opts.courseInstructorId ?? null },
                );
            },
        },
        courseOpening: {
            findMany: (args: any) => {
                calls.push({ model: 'courseOpening.findMany', args });
                return Promise.resolve(taught.map((courseId) => ({ courseId })));
            },
            findFirst: (args: any) => {
                calls.push({ model: 'courseOpening.findFirst', args });
                const match = taught.find((c) => c === args?.where?.courseId);
                return Promise.resolve(match ? { id: 'opening-1' } : null);
            },
        },
        enrollment: {
            findMany: (args: any) => {
                calls.push({ model: 'enrollment.findMany', args });
                return Promise.resolve(enrolled.map((courseId) => ({ courseId })));
            },
            findFirst: (args: any) => {
                calls.push({ model: 'enrollment.findFirst', args });
                return Promise.resolve(
                    enrolled.includes(args?.where?.courseId) ? { id: 'enr-1' } : null,
                );
            },
        },
        certificate: {
            findUnique: (args: any) => {
                calls.push({ model: 'certificate.findUnique', args });
                if (args?.select?.printedAt) {
                    return Promise.resolve({ printedAt: opts.printedAt ?? null });
                }
                return Promise.resolve(
                    opts.certificate === undefined ? { id: 'cert-1', studentId: 'someone-else', courseId: opts.courseId } : opts.certificate,
                );
            },
            update: (args: any) => {
                calls.push({ model: 'certificate.update', args });
                return Promise.resolve({
                    id: args.where.id,
                    printedAt: new Date('2026-01-01T00:00:00Z'),
                    printedBy: { id: args.data.printedById, email: 'actor@example.com' },
                });
            },
        },
    };
    return { prisma, calls };
}

const noopService: any = { logAction: () => Promise.resolve() };

function coursesService(prisma: any) {
    return new CoursesService(prisma, noopService, noopService, noopService);
}

function certsService(prisma: any, audited: string[]) {
    const audit: any = {
        logAction: (action: string) => {
            audited.push(action);
            return Promise.resolve();
        },
    };
    return new CertificatesService(prisma, audit, noopService);
}

// ---------------------------------------------------------------- finding 1

describe('finding 1: anonymous callers must not see closed batches', () => {
    test('findAll without a viewer restricts openings to OPEN/ANNOUNCEMENT', async () => {
        const { prisma, calls } = makePrismaStub({});
        await coursesService(prisma).findAll(false, undefined);

        const listCall = calls.find((c) => c.model === 'course.findMany')!;
        const where = listCall.args.include.openings.where;
        assert.deepEqual(where.status.in, OPEN_STATUSES,
            'anonymous openings must be limited to OPEN/ANNOUNCEMENT');
        assert.equal(where.isPublished, true);
    });

    test('findAll with no viewer at all is treated the same', async () => {
        const { prisma, calls } = makePrismaStub({});
        await coursesService(prisma).findAll(false);
        const where = calls.find((c) => c.model === 'course.findMany')!.args.include.openings.where;
        assert.deepEqual(where.status.in, OPEN_STATUSES);
    });

    test('findOne without a viewer restricts openings to OPEN/ANNOUNCEMENT', async () => {
        const { prisma, calls } = makePrismaStub({ courseId: 'c1', courseInstructorId: 'other' });
        await coursesService(prisma).findOne('c1', false, undefined);

        const where = calls.find((c) => c.model === 'course.findUnique')!.args.include.openings.where;
        assert.deepEqual(where.status.in, OPEN_STATUSES);
    });

    test('includeUnpublished (staff) still sees every batch', async () => {
        const { prisma, calls } = makePrismaStub({});
        await coursesService(prisma).findAll(true, { userId: 'u1', role: Role.ADMIN });
        const where = calls.find((c) => c.model === 'course.findMany')!.args.include.openings.where;
        assert.equal(where, undefined, 'staff must keep the unfiltered relation');
    });

    test('an ADMIN who forgot includeUnpublished still sees published batches', async () => {
        const { prisma, calls } = makePrismaStub({});
        await coursesService(prisma).findAll(false, { userId: 'u1', role: Role.ADMIN });
        const where = calls.find((c) => c.model === 'course.findMany')!.args.include.openings.where;
        assert.equal(where.isPublished, true);
        assert.equal(where.status, undefined, 'staff keep ENDED/STARTED batches');
    });

    test('an unrelated user still only sees OPEN/ANNOUNCEMENT', async () => {
        const { prisma, calls } = makePrismaStub({ taughtCourseIds: ['other-course'], enrolledCourseIds: ['other-course'] });
        await coursesService(prisma).findAll(false, { userId: 'u1', role: Role.INSTRUCTOR });
        const where = calls.find((c) => c.model === 'course.findMany')!.args.include.openings.where;
        // The OR branch keeps their own course reachable without opening the
        // closed batches of every other course.
        assert.ok(where.OR, 'a related viewer needs the OR branch');
        assert.deepEqual(where.OR[0].status.in, OPEN_STATUSES);
    });

    test('ENDED and STARTED are never in the anonymous status list', async () => {
        const { prisma, calls } = makePrismaStub({});
        await coursesService(prisma).findAll(false, undefined);
        const allowed = calls.find((c) => c.model === 'course.findMany')!.args.include.openings.where.status.in;
        assert.ok(!allowed.includes(ENDED), 'ENDED must not be exposed anonymously');
        assert.ok(!allowed.includes(STARTED), 'STARTED must not be exposed anonymously');
    });
});

// ---------------------------------------------------------------- finding 2

describe('finding 2: markPrinted must leave an audit trail', () => {
    const cert = {
        id: 'cert-1',
        studentId: 'owner-1',
        verificationStatus: CertificateStatus.VALID,
        courseId: 'c1',
        course: { titleAr: 'دورة', titleEn: 'Course' },
    };

    test('a first print is audited', async () => {
        const audited: string[] = [];
        const { prisma } = makePrismaStub({ courseId: 'c1', certificate: cert, printedAt: null });
        await certsService(prisma, audited).markPrinted('cert-1', { userId: 'owner-1', role: Role.STUDENT });

        assert.equal(audited.length, 1, 'markPrinted wrote no audit entry');
        assert.match(audited[0], /Printed certificate cert-1/);
        assert.match(audited[0], /Course/, 'the course should be identifiable in the trail');
    });

    test('a reprint is audited distinctly from the first handover', async () => {
        const audited: string[] = [];
        const { prisma } = makePrismaStub({
            courseId: 'c1', certificate: cert, printedAt: new Date('2025-01-01T00:00:00Z'),
        });
        await certsService(prisma, audited).markPrinted('cert-1', { userId: 'owner-1', role: Role.STUDENT });

        assert.equal(audited.length, 1);
        assert.match(audited[0], /Re-printed/, 'a reprint must be distinguishable');
    });

    test('the audit entry is written even when the certificate has no course', async () => {
        const audited: string[] = [];
        const { prisma } = makePrismaStub({
            certificate: { ...cert, courseId: null, course: null },
        });
        await certsService(prisma, audited).markPrinted('cert-1', {
            userId: 'owner-1', role: Role.STUDENT,
        });
        assert.equal(audited.length, 1);
    });

    test('a rejected print leaves no audit entry', async () => {
        const audited: string[] = [];
        const { prisma } = makePrismaStub({
            courseId: 'c1',
            certificate: { ...cert, verificationStatus: CertificateStatus.REVOKED },
        });
        await assert.rejects(
            () => certsService(prisma, audited).markPrinted('cert-1', { userId: 'owner-1', role: Role.STUDENT }),
            /revoked/i,
        );
        assert.equal(audited.length, 0, 'a refused print must not be recorded as a handover');
    });
});

// ---------------------------------------------------------------- finding 3

describe('finding 3: only staff tied to the course may release a certificate', () => {
    const cert = {
        id: 'cert-1',
        studentId: 'owner-1',
        verificationStatus: CertificateStatus.VALID,
        courseId: 'c1',
        course: { titleAr: 'دورة', titleEn: 'Course' },
    };

    test('an instructor of ANOTHER course is refused', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'real-teacher', certificate: cert, taughtCourseIds: [],
        });
        await assert.rejects(
            () => certsService(prisma, []).markPrinted('cert-1', { userId: 'stranger', role: Role.INSTRUCTOR }),
            /do not teach this course/i,
        );
    });

    test('the course instructor may release', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'teacher-1', certificate: cert, taughtCourseIds: [],
        });
        const out = await certsService(prisma, []).markPrinted('cert-1', {
            userId: 'teacher-1', role: Role.INSTRUCTOR,
        });
        assert.ok(out.printedAt, 'the teacher of the course should be allowed');
    });

    test('an instructor of one of its batches may release', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'someone-else', certificate: cert,
            taughtCourseIds: ['c1'],
        });
        const out = await certsService(prisma, []).markPrinted('cert-1', {
            userId: 'batch-teacher', role: Role.INSTRUCTOR,
        });
        assert.ok(out.printedAt, 'a batch instructor of this course should be allowed');
    });

    test('an ADMIN may release regardless of teaching', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'someone-else', certificate: cert, taughtCourseIds: [],
        });
        const out = await certsService(prisma, []).markPrinted('cert-1', { userId: 'boss', role: Role.ADMIN });
        assert.ok(out.printedAt);
    });

    test('a COURSE_MANAGER may release regardless of teaching', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'someone-else', certificate: cert, taughtCourseIds: [],
        });
        const out = await certsService(prisma, []).markPrinted('cert-1', { userId: 'boss', role: Role.COURSE_MANAGER });
        assert.ok(out.printedAt);
    });

    test('an unrelated STUDENT is refused', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'teacher-1', certificate: cert, taughtCourseIds: [],
        });
        await assert.rejects(
            () => certsService(prisma, []).markPrinted('cert-1', { userId: 'nosy', role: Role.STUDENT }),
            /cannot print/i,
        );
    });

    test('the owner may always release their own certificate', async () => {
        const { prisma } = makePrismaStub({
            courseId: 'c1', courseInstructorId: 'teacher-1', certificate: cert, taughtCourseIds: [],
        });
        const out = await certsService(prisma, []).markPrinted('cert-1', {
            userId: 'owner-1', role: Role.STUDENT,
        });
        assert.ok(out.printedAt, 'a student must be able to print their own certificate');
    });

    test('a course-less certificate is staff-only', async () => {
        const { prisma } = makePrismaStub({
            certificate: { ...cert, courseId: null, course: null }, taughtCourseIds: ['c1'],
        });
        await assert.rejects(
            () => certsService(prisma, []).markPrinted('cert-1', { userId: 'batch-teacher', role: Role.INSTRUCTOR }),
            /cannot print/i,
            'without a course there is no teaching assignment to check against',
        );
    });
});
