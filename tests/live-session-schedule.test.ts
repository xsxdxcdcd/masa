import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';
import { CreateLiveSessionDto } from '../src/live-sessions/dto/live-session.dto';
import { UpdateLiveSessionDto } from '../src/live-sessions/dto/update-live-session.dto';
import { LiveSessionsController } from '../src/live-sessions/live-sessions.controller';
import { LiveSessionsService } from '../src/live-sessions/live-sessions.service';
import { resolveClassroom } from '../src/common/classroom';

/**
 * The weekly meeting schedule of a batch.
 *
 * Two things are worth guarding here, and both are ways this feature can hand
 * out a paid classroom to the wrong person.
 *
 *  1. A session's `meetLink` is optional and falls back to the batch's room.
 *     That fallback is the point -- one recurring Meet is reused every week --
 *     but it means a session carries a link it does not visibly own, so the
 *     "does this session have its own room" flag has to survive the resolution
 *     for the UI to stop showing a stale link field as filled.
 *  2. The link is only ever served through `resolveClassroom`, which is gated
 *     on APPROVED + ONLINE. Staff CRUD is a separate route with its own
 *     permission check, and a session id from another batch must not be
 *     reachable by editing it under a batch you do own.
 */

// Same options as the global pipe in src/main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const run = (cls: any, body: unknown) => pipe.transform(body as any, { type: 'body', metatype: cls }) as any;

// A valid session, as the staff form posts it.
const goodSession = {
    titleAr: 'الجلسة الأولى',
    titleEn: 'Session 1',
    scheduledAt: '2026-10-07T19:00:00.000Z',
    durationMinutes: 90,
    meetLink: 'https://meet.google.com/abc-defg-hij',
};

describe('live session input', () => {
    test('every controller handler declares a DTO class the pipe can introspect', () => {
        // An inline `Partial<CreateLiveSessionDto>` is erased to Object in the
        // emitted design:paramtypes, which silently disables both validation
        // and the date transform -- the bug that made PATCH /openings 500.
        // create(openingId, dto, req) -> index 1; update(openingId, id, dto, req) -> index 2.
        for (const [method, index] of [['create', 1], ['update', 2]] as const) {
            const paramtypes = Reflect.getMetadata(
                'design:paramtypes',
                LiveSessionsController.prototype,
                method,
            ) as any[];
            assert.equal(paramtypes[index], method === 'create' ? CreateLiveSessionDto : UpdateLiveSessionDto);
        }
    });

    test('UpdateLiveSessionDto really carries validators', () => {
        // PartialType inherits metadata, but only if the base is a class. If
        // the validator set were empty the pipe would let anything through.
        const inherited = getMetadataStorage().getTargetValidationMetadatas(UpdateLiveSessionDto, '', true, false);
        assert.ok(inherited.length > 0, 'UpdateLiveSessionDto must have validation metadata');
    });

    test('a full session passes and the duration arrives as a number', async () => {
        const out = await run(CreateLiveSessionDto, goodSession);
        assert.equal(out.titleEn, 'Session 1');
        assert.equal(out.durationMinutes, 90);
    });

    test('a partial edit is allowed, and the date-only value is normalised', async () => {
        const out = await run(UpdateLiveSessionDto, { scheduledAt: '2026-10-07' });
        assert.deepEqual(Object.keys(out), ['scheduledAt']);
        assert.equal(out.scheduledAt, new Date('2026-10-07').toISOString());
    });

    test('the titles are required in both languages', async () => {
        await assert.rejects(() => run(CreateLiveSessionDto, { scheduledAt: goodSession.scheduledAt }), BadRequestException);
        await assert.rejects(() => run(CreateLiveSessionDto, { ...goodSession, titleEn: '' }), BadRequestException);
    });

    test('an unparsable date is a 400 rather than an Invalid Date', async () => {
        await assert.rejects(() => run(CreateLiveSessionDto, { ...goodSession, scheduledAt: 'next tuesday' }), BadRequestException);
    });

    test('a nonsense duration is refused, and the link itself is optional', async () => {
        for (const durationMinutes of [0, -30, 9999, 12.5]) {
            await assert.rejects(
                () => run(CreateLiveSessionDto, { ...goodSession, durationMinutes }),
                BadRequestException,
            );
        }
        // Omitting the link is the normal case: the batch room is reused.
        const out = await run(CreateLiveSessionDto, { ...goodSession, meetLink: undefined, durationMinutes: undefined });
        assert.equal(out.durationMinutes, undefined);
    });

    test('an unknown property is rejected', async () => {
        await assert.rejects(() => run(CreateLiveSessionDto, { ...goodSession, googleMeetData: {} }), BadRequestException);
    });
});

describe('resolveClassroom applies the schedule rules', () => {
    const batch = { deliveryMode: 'ONLINE' as any, meetLink: 'https://meet.google.com/room-1' };

    const session = (over: Record<string, unknown> = {}) => ({
        id: 's1',
        titleAr: 'أ',
        titleEn: 'A',
        scheduledAt: new Date('2026-10-07T19:00:00.000Z'),
        durationMinutes: 90,
        meetLink: null,
        ...over,
    });

    test('a session with no link of its own inherits the batch room', () => {
        const out = resolveClassroom('APPROVED', batch, [session()]);
        assert.equal(out.liveSessions[0].meetLink, 'https://meet.google.com/room-1');
        // The UI needs this to know the link field is empty rather than filled.
        assert.equal(out.liveSessions[0].hasOwnLink, false);
        assert.equal(out.meetLink, 'https://meet.google.com/room-1');
    });

    test("a session's own room wins over the batch room", () => {
        const out = resolveClassroom('APPROVED', batch, [
            session({ meetLink: 'https://meet.google.com/special-one' }),
        ]);
        assert.equal(out.liveSessions[0].meetLink, 'https://meet.google.com/special-one');
        assert.equal(out.liveSessions[0].hasOwnLink, true);
    });

    test('the schedule is ordered by time even if it arrives unsorted', () => {
        const out = resolveClassroom('APPROVED', batch, [
            session({ id: 'late', scheduledAt: new Date('2026-10-21T19:00:00.000Z') }),
            session({ id: 'early', scheduledAt: new Date('2026-10-07T19:00:00.000Z') }),
        ]);
        assert.deepEqual(out.liveSessions.map((s) => s.id), ['early', 'late']);
    });

    test('an in-person batch shows dates but no room', () => {
        const out = resolveClassroom('APPROVED', { deliveryMode: 'IN_PERSON' as any, meetLink: null }, [session()]);
        assert.equal(out.liveSessions.length, 1);
        assert.equal(out.liveSessions[0].meetLink, null);
        assert.equal(out.meetLink, null);
    });

    test('a link stored on an in-person batch is still not served', () => {
        // The mode is the gate, not the presence of the column.
        const out = resolveClassroom('APPROVED', { deliveryMode: 'IN_PERSON' as any, meetLink: 'https://meet.google.com/room-1' }, [session()]);
        assert.equal(out.liveSessions[0].meetLink, null);
        assert.equal(out.meetLink, null);
    });

    test('nobody but an approved student gets the schedule or its rooms', () => {
        for (const status of ['PENDING', 'RESERVED', 'REJECTED', 'REVOKED', null, undefined]) {
            const out = resolveClassroom(status as any, batch, [session()]);
            assert.deepEqual(out, { deliveryMode: null, meetLink: null, liveSessions: [] });
        }
    });

    test('an approved student with no batch gets nothing rather than throwing', () => {
        assert.deepEqual(resolveClassroom('APPROVED', null, [session()]), {
            deliveryMode: null, meetLink: null, liveSessions: [],
        });
    });
});

describe('LiveSessionsService', () => {
    const noop = { logAction: () => Promise.resolve() };

    function service(prisma: any, manage: (id: string, actorId: string, role: any) => any = () => Promise.resolve({ id: 'o1', courseId: 'c1' })) {
        // A course lookup is part of writing a session: a pre-recorded course has
        // no meetings to schedule. Default it to live so the tests below stay
        // about the schedule itself.
        prisma.course = prisma.course ?? {
            findUnique: () => Promise.resolve({ contentType: 'LIVE' }),
        };
        return new LiveSessionsService(prisma, { assertCanManageOpening: manage } as any, noop as any);
    }

    const actor = { actorId: 'i1', actorRole: 'INSTRUCTOR' as any };

    test('creating a session trims the titles, parses the date and stores the link', async () => {
        let data: any;
        const prisma = {
            liveSession: {
                create: (args: any) => { data = args.data; return Promise.resolve({ id: 's1', ...args.data }); },
            },
        };
        await service(prisma).create('o1', {
            titleAr: '  الجلسات  ', titleEn: '  Session  ', scheduledAt: '2026-10-07T19:00:00.000Z',
            durationMinutes: 90, meetLink: 'https://meet.google.com/abc-defg-hij',
        } as any, actor.actorId, actor.actorRole);

        assert.equal(data.titleAr, 'الجلسات');
        assert.equal(data.titleEn, 'Session');
        assert.equal(data.scheduledAt.toISOString(), '2026-10-07T19:00:00.000Z');
        assert.equal(data.openingId, 'o1');
        assert.equal(data.meetLink, 'https://meet.google.com/abc-defg-hij');
    });

    test('a session created without a room inherits the batch link', async () => {
        let data: any;
        const prisma = {
            liveSession: {
                create: (args: any) => { data = args.data; return Promise.resolve({ id: 's1' }); },
            },
        };
        await service(prisma).create('o1', {
            titleAr: 'أ', titleEn: 'A', scheduledAt: '2026-10-07T19:00:00.000Z',
        } as any, actor.actorId, actor.actorRole);
        assert.equal(data.meetLink, null);
    });

    test('a room on an unexpected host is refused at write time', async () => {
        // The link is rendered as a prominent join button to every approved
        // student, so it is validated here and not only when it is read.
        const prisma = { liveSession: { create: () => Promise.reject(new Error('must not be reached')) } };
        await assert.rejects(
            () => service(prisma).create('o1', {
                titleAr: 'أ', titleEn: 'A', scheduledAt: '2026-10-07T19:00:00.000Z',
                meetLink: 'https://evil.test/meet',
            } as any, actor.actorId, actor.actorRole),
            /must be a Google Meet/,
        );
    });

    test('editing one field leaves the others alone', async () => {
        let data: any;
        const prisma = {
            liveSession: {
                findUnique: () => Promise.resolve({ id: 's1', openingId: 'o1' }),
                update: (args: any) => { data = args.data; return Promise.resolve({ id: 's1' }); },
            },
        };
        await service(prisma).update('o1', 's1', { scheduledAt: '2026-10-14T19:00:00.000Z' } as any, actor.actorId, actor.actorRole);
        assert.deepEqual(Object.keys(data), ['scheduledAt']);
    });

    test('an explicit null clears the room so the batch link is used again', async () => {
        let data: any;
        const prisma = {
            liveSession: {
                findUnique: () => Promise.resolve({ id: 's1', openingId: 'o1' }),
                update: (args: any) => { data = args.data; return Promise.resolve({ id: 's1' }); },
            },
        };
        await service(prisma).update('o1', 's1', { meetLink: null } as any, actor.actorId, actor.actorRole);
        assert.equal(data.meetLink, null);
    });

    test("a session cannot be edited through a batch you do not teach", async () => {
        // Otherwise an instructor of batch A could edit batch B's session just by
        // putting B's session id under A's URL.
        const prisma = {
            liveSession: {
                findUnique: () => Promise.resolve({ id: 's1', openingId: 'other-opening' }),
                update: () => Promise.reject(new Error('must not be reached')),
                delete: () => Promise.reject(new Error('must not be reached')),
            },
        };
        const svc = service(prisma);
        const isMissingSession = (err: any) => err?.status === 404 && /Session not found/.test(err?.message ?? '');
        await assert.rejects(() => svc.update('o1', 's1', { titleEn: 'X' } as any, actor.actorId, actor.actorRole), isMissingSession);
        await assert.rejects(() => svc.remove('o1', 's1', actor.actorId, actor.actorRole), isMissingSession);
    });

    test('an unknown session id is a 404, not a write against nothing', async () => {
        const prisma = {
            liveSession: {
                findUnique: () => Promise.resolve(null),
                update: () => Promise.reject(new Error('must not be reached')),
            },
        };
        await assert.rejects(
            () => service(prisma).update('o1', 'ghost', { titleEn: 'X' } as any, actor.actorId, actor.actorRole),
            { status: 404 },
        );
    });

    test('every write goes through the batch permission check first', async () => {
        const isDenied = (err: any) => err?.status === 403 && /not allowed/.test(err?.message ?? '');
        const boom = () => Promise.reject(Object.assign(new Error('You are not allowed to manage this opening'), { status: 403 }));
        const prisma = {
            liveSession: {
                findMany: () => Promise.reject(new Error('must not be reached')),
                create: () => Promise.reject(new Error('must not be reached')),
                findUnique: () => Promise.reject(new Error('must not be reached')),
                update: () => Promise.reject(new Error('must not be reached')),
                delete: () => Promise.reject(new Error('must not be reached')),
            },
        };
        const svc = service(prisma, boom);
        await assert.rejects(() => svc.listForStaff('o1', actor.actorId, actor.actorRole), isDenied);
        await assert.rejects(() => svc.create('o1', { titleAr: 'أ', titleEn: 'A', scheduledAt: '2026-10-07T19:00:00.000Z' } as any, actor.actorId, actor.actorRole), isDenied);
        await assert.rejects(() => svc.update('o1', 's1', { titleEn: 'X' } as any, actor.actorId, actor.actorRole), isDenied);
        await assert.rejects(() => svc.remove('o1', 's1', actor.actorId, actor.actorRole), isDenied);
    });

    test('the staff listing is ordered by time and carries no student data', async () => {
        let args: any;
        const prisma = {
            liveSession: {
                findMany: (a: any) => { args = a; return Promise.resolve([]); },
            },
        };
        await service(prisma).listForStaff('o1', actor.actorId, actor.actorRole);
        assert.equal(args.where.openingId, 'o1');
        assert.deepEqual(args.orderBy, { scheduledAt: 'asc' });
    });
});
