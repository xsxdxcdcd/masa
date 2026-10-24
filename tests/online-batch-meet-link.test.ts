import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMeetLink } from '../src/common/meeting-links';
import { CoursesService } from '../src/courses/courses.service';
import { EnrollmentsService } from '../src/enrollments/enrollments.service';
import { LessonsService } from '../src/lms/lessons.service';

/**
 * The classroom link is the highest-trust URL in the product: staff type it and
 * it is rendered as a prominent "join the lesson" button to every approved
 * student. These tests pin the three rules that make that safe.
 *
 *  1. Only https links on a known meeting host may be stored. `javascript:`,
 *     a lookalike host and credentials-in-URL are all rejected.
 *  2. Mode and link are one fact: an in-person batch cannot carry a link, and
 *     switching a batch back to in-person drops the stored one so it cannot be
 *     resurrected later.
 *  3. The link reaches students who are APPROVED in an ONLINE batch, and
 *     nobody else — not a PENDING applicant, not a REVOKED one, and never
 *     through the public `/courses` payload.
 */

const noop = { logAction: () => Promise.resolve(), notify: () => Promise.resolve() };

function enrollmentsService(prisma: any) {
    return new EnrollmentsService(prisma, noop as any, noop as any, noop as any, noop as any);
}

describe('normalizeMeetLink', () => {
    test('accepts Google Meet, Zoom and Teams over https', () => {
        assert.equal(
            normalizeMeetLink('https://meet.google.com/abc-defg-hij'),
            'https://meet.google.com/abc-defg-hij',
        );
        assert.equal(
            normalizeMeetLink('https://laxalab.zoom.us/j/123456789'),
            'https://laxalab.zoom.us/j/123456789',
        );
        assert.ok(normalizeMeetLink('https://teams.microsoft.com/l/meetup-join/x')?.startsWith('https://teams.microsoft.com/'));
    });

    test('rejects a non-https scheme, so javascript: cannot be stored', () => {
        // The link is rendered into an href. http and javascript would both be
        // either a downgrade or a stored-XSS vector on the students' side.
        assert.throws(() => normalizeMeetLink('javascript:alert(1)'), /https/);
        assert.throws(() => normalizeMeetLink('http://meet.google.com/x'), /https/);
        assert.throws(() => normalizeMeetLink('data:text/html,<script>alert(1)</script>'), /https/);
    });

    test('rejects a host that merely looks like a meeting host', () => {
        // "evismeet.google.com" ends with the suffix as a raw string but is a
        // different registrable domain; a substring check would let it through.
        assert.throws(() => normalizeMeetLink('https://evismeet.google.com/x'), /must be a Google Meet/);
        assert.throws(() => normalizeMeetLink('https://meet.google.com.evil.test/x'), /must be a Google Meet/);
        assert.throws(() => normalizeMeetLink('https://evil.test/meet.google.com'), /must be a Google Meet/);
    });

    test('rejects credentials embedded in the URL', () => {
        assert.throws(
            () => normalizeMeetLink('https://meet.google.com@evil.test/x'),
            /must not embed credentials/,
        );
    });

    test('rejects junk, and treats empty as an explicit clear', () => {
        assert.throws(() => normalizeMeetLink('not a url'), /valid URL/);
        assert.throws(() => normalizeMeetLink(123), /must be a string/);
        assert.throws(() => normalizeMeetLink('https://meet.google.com/' + 'a'.repeat(600)), /too long/);
        assert.equal(normalizeMeetLink(''), null);
        assert.equal(normalizeMeetLink(null), null);
        // Omitted is "leave it alone", which is different from clearing it.
        assert.equal(normalizeMeetLink(undefined), undefined);
    });
});

describe('CoursesService opening delivery mode', () => {
    function service(prisma: any) {
        return new CoursesService(prisma, noop as any, noop as any, noop as any);
    }

    const staff = { actorId: 'admin-1', actorRole: 'ADMIN' as any };

    test('createOpening stores an online batch and its link', async () => {
        let created: any;
        const prisma = {
            course: { findUnique: () => Promise.resolve({ id: 'c1' }) },
            user: { findUnique: () => Promise.resolve({ id: 'i1' }) },
            courseOpening: {
                create: (args: any) => { created = args.data; return Promise.resolve({ id: 'o1', ...args.data }); },
            },
        };
        const svc = service(prisma);
        await svc.createOpening('c1', {
            instructorId: 'i1',
            price: 100,
            deliveryMode: 'ONLINE' as any,
            meetLink: 'https://meet.google.com/xyz-abcd-efg',
        } as any);

        assert.equal(created.deliveryMode, 'ONLINE');
        assert.equal(created.meetLink, 'https://meet.google.com/xyz-abcd-efg');
    });

    test('createOpening defaults to in person with no link', async () => {
        let created: any;
        const prisma = {
            course: { findUnique: () => Promise.resolve({ id: 'c1' }) },
            user: { findUnique: () => Promise.resolve({ id: 'i1' }) },
            courseOpening: {
                create: (args: any) => { created = args.data; return Promise.resolve({ id: 'o1' }); },
            },
        };
        await service(prisma).createOpening('c1', { instructorId: 'i1', price: 100 } as any);
        assert.equal(created.deliveryMode, 'IN_PERSON');
        assert.equal(created.meetLink, null);
    });

    test('a link on an in-person batch is refused rather than silently dropped', async () => {
        const prisma = {
            course: { findUnique: () => Promise.resolve({ id: 'c1' }) },
            user: { findUnique: () => Promise.resolve({ id: 'i1' }) },
            courseOpening: { create: () => Promise.reject(new Error('must not be reached')) },
        };
        await assert.rejects(
            () => service(prisma).createOpening('c1', {
                instructorId: 'i1', price: 100,
                deliveryMode: 'IN_PERSON' as any,
                meetLink: 'https://meet.google.com/xyz',
            } as any),
            /only applies to an ONLINE batch/,
        );
    });

    test('switching an online batch back to in person clears the stored link', async () => {
        let patch: any;
        const prisma = {
            courseOpening: {
                findUnique: () => Promise.resolve({ id: 'o1', instructorId: 'i1', deliveryMode: 'ONLINE' }),
                update: (args: any) => { patch = args.data; return Promise.resolve({ id: 'o1', ...args.data }); },
            },
        };
        await service(prisma).updateOpening('o1', { deliveryMode: 'IN_PERSON' } as any, staff.actorId, staff.actorRole);

        assert.equal(patch.deliveryMode, 'IN_PERSON');
        // The point of clearing: flipping the mode back to ONLINE later must not
        // resurrect a classroom that nobody is using any more.
        assert.equal(patch.meetLink, null);
    });

    test('editing only the link keeps the existing mode', async () => {
        let patch: any;
        const prisma = {
            courseOpening: {
                findUnique: () => Promise.resolve({ id: 'o1', instructorId: 'i1', deliveryMode: 'ONLINE' }),
                update: (args: any) => { patch = args.data; return Promise.resolve({ id: 'o1' }); },
            },
        };
        await service(prisma).updateOpening(
            'o1',
            { meetLink: 'https://meet.google.com/new-room' } as any,
            staff.actorId, staff.actorRole,
        );
        // No deliveryMode key at all: the PATCH must not flip the mode.
        assert.equal('deliveryMode' in patch, false);
        assert.equal(patch.meetLink, 'https://meet.google.com/new-room');
    });
});

describe('the classroom link never reaches a public route', () => {
    // The real hazard: `/courses`, `/courses/:id` and `/courses/:id/openings`
    // are all reachable without a token, and Prisma `include` returns every
    // scalar column — so the room would be published to any anonymous visitor
    // unless the service strips it before the payload leaves the process.
    function service(prisma: any) {
        return new CoursesService(prisma, noop as any, noop as any, noop as any);
    }

    const opening = (extra: Record<string, unknown> = {}) => ({
        id: 'o1',
        courseId: 'c1',
        instructorId: 'i1',
        nameAr: 'ب',
        nameEn: 'b',
        deliveryMode: 'ONLINE',
        meetLink: 'https://meet.google.com/room-1',
        isPublished: true,
        status: 'OPEN',
        ...extra,
    });

    /**
     * findOne walks several lookups (paid-content entitlement, visible-opening
     * filter, viewerAccess) that have nothing to do with what is under test.
     * Only the reads that matter are scripted; everything else answers empty so
     * the test asserts the redaction rather than the mock's completeness.
     */
    function coursePagePrisma(viewer: { enrolled: boolean }) {
        return {
            course: {
                findUnique: () => Promise.resolve({
                    id: 'c1', instructorId: 'i1', titleAr: 'د', titleEn: 'c',
                    descriptionAr: null, descriptionEn: null, price: 100, currency: 'SAR',
                    openings: [opening()], modules: [], chapters: [], objectives: [],
                    prerequisites: [], audiences: [], faqs: [], gallery: [],
                    instructor: { id: 'i1', email: 'i@x.test', role: 'INSTRUCTOR', metadata: null },
                    _count: { enrollments: viewer.enrolled ? 1 : 0, modules: 0 },
                }),
                findFirst: () => Promise.resolve(null),
            },
            enrollment: {
                findFirst: () => Promise.resolve(viewer.enrolled ? { id: 'e1' } : null),
                findMany: () => Promise.resolve(viewer.enrolled ? [{ courseId: 'c1' }] : []),
            },
            courseOpening: { findFirst: () => Promise.resolve(null), findMany: () => Promise.resolve([]) },
        } as any;
    }

    test('listOpenings hides the link from an anonymous caller', async () => {
        const prisma = {
            course: { findUnique: () => Promise.resolve({ id: 'c1' }) },
            courseOpening: { findMany: () => Promise.resolve([opening()]) },
        };
        const out = await service(prisma).listOpenings('c1');
        assert.equal('meetLink' in (out[0] as any), false);
        assert.equal(JSON.stringify(out).includes('room-1'), false);
        // The mode itself is public syllabus information and stays.
        assert.equal(out[0].deliveryMode, 'ONLINE');
    });

    test('listOpenings still shows the link to an admin managing the batch', async () => {
        const prisma = {
            course: { findUnique: () => Promise.resolve({ id: 'c1' }) },
            courseOpening: { findMany: () => Promise.resolve([opening()]) },
        };
        const out = await service(prisma).listOpenings('c1', true, { userId: 'admin-1', role: 'ADMIN' as any });
        assert.equal(out[0].meetLink, 'https://meet.google.com/room-1');
    });

    test('findOne hides the link from an anonymous caller', async () => {
        const out: any = await service(coursePagePrisma({ enrolled: false })).findOne('c1');
        assert.equal('meetLink' in out.openings[0], false);
        assert.equal(JSON.stringify(out).includes('room-1'), false);
    });

    test('an enrolled student reading the public course page still gets no link', async () => {
        // Entitlement is deliberately NOT what gates this. The public course
        // page is a marketing page; the room is served from the enrollment and
        // the player, where the APPROVED check lives.
        const out: any = await service(coursePagePrisma({ enrolled: true }))
            .findOne('c1', false, { userId: 's1', role: 'STUDENT' as any });
        assert.equal(JSON.stringify(out).includes('room-1'), false);
    });
});

describe('classroom link reach', () => {
    const ONLINE_APPROVED = {
        status: 'APPROVED',
        opening: { deliveryMode: 'ONLINE', meetLink: 'https://meet.google.com/room-1' },
    };

    function myEnrollmentsPrisma(rows: any[]) {
        return {
            enrollment: { findMany: () => Promise.resolve(rows) },
        };
    }

    const row = (status: string, mode: string | null, link: string | null) => ({
        id: 'e1',
        status,
        createdAt: new Date('2026-01-01'),
        financeOfficerNotes: null,
        course: { id: 'c1', titleAr: 'د', titleEn: 'c', descriptionAr: null, descriptionEn: null, instructor: { id: 'i1', email: 'i@x.test', role: 'INSTRUCTOR' }, _count: { modules: 3 } },
        opening: { id: 'o1', status: 'OPEN', nameAr: 'ب', nameEn: 'b', price: '100', priceOld: null, startDate: null, endDate: null, enrollmentDeadline: null, isPublished: true, deliveryMode: mode, meetLink: link, instructor: { id: 'i1', email: 'i@x.test', role: 'INSTRUCTOR' } },
        _count: { lessonProgress: 1 },
    });

    test('an approved student of an online batch gets the link', async () => {
        const [out] = await enrollmentsService(
            myEnrollmentsPrisma([row('APPROVED', 'ONLINE', 'https://meet.google.com/room-1')]),
        ).getMyEnrollments('s1');
        assert.equal(out.meetLink, 'https://meet.google.com/room-1');
    });

    test('a PENDING applicant does not get the link', async () => {
        const [out] = await enrollmentsService(
            myEnrollmentsPrisma([row('PENDING', 'ONLINE', 'https://meet.google.com/room-1')]),
        ).getMyEnrollments('s1');
        assert.equal(out.meetLink, null);
    });

    test('a RESERVED applicant does not get the link', async () => {
        const [out] = await enrollmentsService(
            myEnrollmentsPrisma([row('RESERVED', 'ONLINE', 'https://meet.google.com/room-1')]),
        ).getMyEnrollments('s1');
        assert.equal(out.meetLink, null);
    });

    test('a REVOKED student does not keep the link', async () => {
        const [out] = await enrollmentsService(
            myEnrollmentsPrisma([row('REVOKED', 'ONLINE', 'https://meet.google.com/room-1')]),
        ).getMyEnrollments('s1');
        assert.equal(out.meetLink, null);
    });

    test('an in-person batch has no link even when one is somehow stored', async () => {
        const [out] = await enrollmentsService(
            myEnrollmentsPrisma([row('APPROVED', 'IN_PERSON', 'https://meet.google.com/room-1')]),
        ).getMyEnrollments('s1');
        assert.equal(out.meetLink, null);
    });

    test('the raw column never rides along inside the nested opening object', async () => {
        // The query selects meetLink so the gate can read it, but `...e` used to
        // spread it straight back out — a pending applicant would still have
        // received the room inside opening.meetLink.
        const [out] = await enrollmentsService(
            myEnrollmentsPrisma([row('PENDING', 'ONLINE', 'https://meet.google.com/room-1')]),
        ).getMyEnrollments('s1');
        assert.equal('meetLink' in (out.opening as any), false);
        assert.equal(JSON.stringify(out).includes('room-1'), false);
    });

    test('the player exposes the link for an approved student and nothing else', async () => {
        function lessonsPrisma(enrollment: any, opening: any) {
            return {
                enrollment: { findUnique: () => Promise.resolve(enrollment) },
                // The teaching format is read alongside the room so the player
                // knows which surface to lead with; it is not part of the gate.
                course: { findUnique: () => Promise.resolve({ contentType: 'LIVE' }) },
                courseOpening: { findUnique: () => Promise.resolve(opening) },
                module: { findMany: () => Promise.resolve([]) },
                lessonProgress: { findMany: () => Promise.resolve([]) },
                courseTask: { findMany: () => Promise.resolve([]) },
                quiz: { findMany: () => Promise.resolve([]) },
                lessonNote: { findMany: () => Promise.resolve([]) },
            };
        }
        const svc = (p: any) => new LessonsService(p, noop as any);
        const online = { id: 'o1', deliveryMode: 'ONLINE', meetLink: 'https://meet.google.com/room-1' };

        const approved = await svc(lessonsPrisma({ id: 'e1', openingId: 'o1', status: 'APPROVED' }, online))
            .courseProgress('c1', 's1');
        assert.equal(approved.meetLink, 'https://meet.google.com/room-1');
        assert.equal(approved.deliveryMode, 'ONLINE');

        const pending = await svc(lessonsPrisma({ id: 'e1', openingId: 'o1', status: 'PENDING' }, online))
            .courseProgress('c1', 's1');
        assert.equal(pending.meetLink, null);
        assert.equal(pending.deliveryMode, null);

        const inPerson = await svc(lessonsPrisma(
            { id: 'e1', openingId: 'o1', status: 'APPROVED' },
            { id: 'o1', deliveryMode: 'IN_PERSON', meetLink: null },
        )).courseProgress('c1', 's1');
        assert.equal(inPerson.meetLink, null);
        assert.equal(inPerson.deliveryMode, null);
    });
});
