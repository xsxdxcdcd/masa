import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CourseContentType } from '@prisma/client';
import { CreateCourseDto, UpdateCourseDto } from '../src/courses/dto/create-course.dto';
import { CoursesService } from '../src/courses/courses.service';
import { LessonsService } from '../src/lms/lessons.service';
import { LiveSessionsService } from '../src/live-sessions/live-sessions.service';
import { assertLessonVideosAllowed, assertLiveSessionsAllowed } from '../src/common/course-content-type';

/**
 * A course is either taught live on Meet or delivered as pre-recorded videos.
 *
 * Storing the type is the easy half. The half that actually matters is that the
 * two cannot be mixed, because the old platform shipped a single course page
 * built around a video player: a live course ended up with an empty player and
 * its meetings buried in a schedule nobody looked at. So the rules are enforced
 * on write:
 *
 *  - a LIVE course cannot carry lesson videos;
 *  - a RECORDED course cannot carry a meeting schedule;
 *  - switching a course's type cannot orphan what already exists.
 *
 * Course-level `introVideoUrl` / `videoFileUrl` are the sales-page trailer and
 * stay legal in both, which is why these guards only look at lessons.
 */

// Same options as the global pipe in src/main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (cls: any, body: unknown) => pipe.transform(body as any, { type: 'body', metatype: cls }) as any;

const minimalCourse = {
    titleAr: 'دورة',
    titleEn: 'Course',
    excerptAr: 'وصف',
    excerptEn: 'Description',
};

const chaptersWithVideo = [
    { titleAr: '一章', titleEn: 'Chapter', modules: [{ titleAr: 'درس', titleEn: 'Lesson', videoUrl: 'https://cdn.example.com/lesson.mp4' }] },
];

describe('the course payload demands a content type', () => {
    test('creating a course without a type is refused', async () => {
        // Defaulting silently would put an unclassified course back on the
        // video-first page, which is the thing being replaced.
        await assert.rejects(() => run(CreateCourseDto, minimalCourse), BadRequestException);
    });

    test('either type is accepted, and an update may leave it alone', async () => {
        for (const contentType of ['LIVE', 'RECORDED']) {
            const out = await run(CreateCourseDto, { ...minimalCourse, contentType });
            assert.equal(out.contentType, contentType);
        }
        const patch = await run(UpdateCourseDto, { titleAr: 'عنوان جديد' });
        assert.equal(patch.contentType, undefined);
    });

    test('a third type is not a type', async () => {
        await assert.rejects(
            () => run(CreateCourseDto, { ...minimalCourse, contentType: 'HYBRID' }),
            BadRequestException,
        );
    });
});

describe('a live course cannot carry lesson videos', () => {
    test('the video is rejected and the chapter is named', () => {
        assert.throws(
            () => assertLessonVideosAllowed(CourseContentType.LIVE, chaptersWithVideo.map((c, i) => ({ videoUrl: c.modules[0].videoUrl, chapterIndex: i }))),
            (err: any) => {
                assert.ok(err instanceof BadRequestException);
                assert.match(err.message, /live course/i);
                assert.match(err.message, /chapter 1/i);
                return true;
            },
        );
    });

    test('a lesson without a video is exactly what a live course looks like', () => {
        assert.doesNotThrow(() =>
            assertLessonVideosAllowed(CourseContentType.LIVE, [{ videoUrl: null }, {}, { videoUrl: '   ' }]),
        );
    });

    test('a recorded course wants the video', () => {
        assert.doesNotThrow(() => assertLessonVideosAllowed(CourseContentType.RECORDED, chaptersWithVideo));
    });

    test('a missing type is treated as live, so a legacy payload cannot sneak past', () => {
        for (const type of [null, undefined]) {
            assert.throws(() => assertLessonVideosAllowed(type, [{ videoUrl: 'https://x.example/v.mp4' }]), BadRequestException);
            assert.doesNotThrow(() => assertLessonVideosAllowed(type, []));
        }
    });
});

describe('a recorded course cannot carry a meeting schedule', () => {
    test('live only', () => {
        assert.doesNotThrow(() => assertLiveSessionsAllowed(CourseContentType.LIVE));
        assert.doesNotThrow(() => assertLiveSessionsAllowed(undefined));
        assert.throws(() => assertLiveSessionsAllowed(CourseContentType.RECORDED), BadRequestException);
    });
});

describe('CoursesService enforces the type on write', () => {
    function courses(prisma: any) {
        return new CoursesService(
            prisma as any,
            { logAction: () => Promise.resolve() } as any,
            {} as any,
            { notify: () => Promise.resolve() } as any,
        );
    }

    const liveWithChapters = { ...minimalCourse, contentType: 'LIVE', chapters: chaptersWithVideo };

    test('create refuses lesson videos on a live course before touching the database', async () => {
        const prisma = { course: { create: () => { throw new Error('must not reach the database'); } } };
        await assert.rejects(
            () => courses(prisma).create(liveWithChapters as any, 'i1'),
            BadRequestException,
        );
    });

    test('create accepts the same lessons on a recorded course', async () => {
        let created: any;
        const prisma = { course: { create: (args: any) => { created = args; return Promise.resolve({ id: 'c1' }); } } };
        await courses(prisma).create({ ...liveWithChapters, contentType: 'RECORDED' } as any, 'i1');
        assert.equal(created.data.contentType, 'RECORDED');
    });

    test('update keeps the stored type when the payload omits it, and still refuses videos', async () => {
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'LIVE' }),
                update: () => Promise.resolve({}),
            },
        };
        const svc = courses(prisma);
        // A price edit on a live course must not be blocked...
        await svc.update('c1', { price: 199 } as any);
        // ...but attaching a video to one must be.
        await assert.rejects(
            () => svc.update('c1', { chapters: chaptersWithVideo } as any),
            BadRequestException,
        );
    });

    test('switching a course with a schedule to recorded is refused, and says why', async () => {
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'LIVE' }),
                update: () => Promise.resolve({}),
            },
            liveSession: { count: () => Promise.resolve(3) },
        };
        await assert.rejects(
            () => courses(prisma).update('c1', { contentType: 'RECORDED' } as any),
            (err: any) => {
                assert.ok(err instanceof BadRequestException);
                assert.match(err.message, /3 live session/);
                return true;
            },
        );
    });

    test('switching a course with no schedule is allowed, and the new type is stored', async () => {
        let saved: any;
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'LIVE' }),
                update: (args: any) => { saved = args.data; return Promise.resolve({}); },
            },
            liveSession: { count: () => Promise.resolve(0) },
        };
        await courses(prisma).update('c1', { contentType: 'RECORDED' } as any).catch(() => undefined);
        // Without this the test would pass even if the guard rejected the switch.
        assert.equal(saved?.contentType, 'RECORDED');
    });

    test('switching a recorded course that still has lesson videos to live is refused', async () => {
        // A live course that keeps its videos is exactly the broken page this
        // type was introduced to end: a player for lessons nobody will watch live.
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'RECORDED' }),
                update: () => { throw new Error('must not reach the database'); },
            },
            liveSession: { count: () => Promise.resolve(0) },
            module: { count: () => Promise.resolve(2) },
        };
        await assert.rejects(
            () => courses(prisma).update('c1', { contentType: 'LIVE' } as any),
            (err: any) => {
                assert.ok(err instanceof BadRequestException);
                assert.match(err.message, /2 lesson video/);
                return true;
            },
        );
    });

    test('resending every lesson without videos in the same request lets the switch through', async () => {
        // The submitted lessons replace the stored ones, so nothing survives that
        // could contradict the new type and the instructor is not forced into two
        // round trips just to convert a course.
        let saved: any;
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'RECORDED' }),
                update: (args: any) => { saved = args.data; return Promise.resolve({}); },
            },
            liveSession: { count: () => Promise.resolve(0) },
            module: { count: () => { throw new Error('every lesson was resubmitted, so none survives'); } },
        };
        await courses(prisma)
            .update('c1', {
                contentType: 'LIVE',
                modules: [{ titleAr: 'درس', titleEn: 'Lesson' }],
                chapters: [{ titleAr: '一章', titleEn: 'Chapter', modules: [{ titleAr: 'درس', titleEn: 'Lesson' }] }],
            } as any)
            .catch(() => undefined);
        // Reaching the write is the assertion: a guard that consulted the stored
        // lessons would have thrown above and left the write untouched.
        assert.equal(saved?.contentType, 'LIVE');
    });

    test('a lesson the request does not resubmit still blocks the switch', async () => {
        // Submitting only `modules` clears the flat lessons but leaves the ones
        // grouped under a chapter attached to the course, videos and all.
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'RECORDED' }),
                update: () => Promise.resolve({}),
            },
            liveSession: { count: () => Promise.resolve(0) },
            module: { count: () => Promise.resolve(1) },
        };
        await assert.rejects(
            () => courses(prisma).update('c1', { contentType: 'LIVE', modules: [] } as any),
            BadRequestException,
        );
    });

    test('resubmitting only the chapters still asks about the flat lessons', async () => {
        // Prisma detaches the lessons of a deleted chapter instead of deleting
        // them, so resubmitting `chapters` does not clear a video that was under
        // one: it survives as a chapter-less lesson of the same course.
        let counted: any;
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'RECORDED' }),
                update: () => Promise.resolve({}),
            },
            liveSession: { count: () => Promise.resolve(0) },
            module: { count: (args: any) => { counted = args; return Promise.resolve(0); } },
        };
        await courses(prisma)
            .update('c1', { contentType: 'LIVE', chapters: [{ titleAr: '一章', titleEn: 'Chapter', modules: [] }] } as any)
            .catch(() => undefined);
        assert.equal(counted?.where?.courseId, 'c1');
        assert.deepEqual(counted?.where?.OR, [{ chapterId: null }]);
    });

    test('re-saving the same type does not consult the schedule or the lessons at all', async () => {
        let saved: any;
        const prisma = {
            course: {
                findUnique: () => Promise.resolve({ id: 'c1', contentType: 'LIVE' }),
                update: (args: any) => { saved = args.data; return Promise.resolve({}); },
            },
            liveSession: {
                count: () => {
                    throw new Error('must not count sessions for an unchanged type');
                },
            },
            module: {
                count: () => {
                    throw new Error('must not count lesson videos for an unchanged type');
                },
            },
        };
        await courses(prisma).update('c1', { contentType: 'LIVE' } as any).catch(() => undefined);
        assert.equal(saved?.contentType, 'LIVE');
    });
});

describe('the player is told which surface to lead with', () => {
    function lessons(prisma: any) {
        return new LessonsService(prisma as any, { award: () => Promise.resolve() } as any);
    }

    const prismaFor = (opening: any) => ({
        enrollment: {
            findUnique: () => Promise.resolve({ id: 'e1', status: 'APPROVED', openingId: 'o1' }),
        },
        // A student with no usable batch (not admitted yet, or no batch at all)
        // still has to be told the teaching format, so it is read off the course.
        course: { findUnique: () => Promise.resolve({ contentType: 'LIVE' }) },
        courseOpening: { findUnique: () => Promise.resolve(opening) },
        module: { findMany: () => Promise.resolve([]) },
        lessonProgress: { findMany: () => Promise.resolve([]) },
        courseTask: { findMany: () => Promise.resolve([]) },
        quiz: { findMany: () => Promise.resolve([]) },
    });

    const openingFor = (contentType: string) => ({
        deliveryMode: 'ONLINE',
        meetLink: 'https://meet.google.com/room-1',
        course: { contentType },
        liveSessions: [],
    });

    test('a recorded course reports RECORDED', async () => {
        const out = await lessons(prismaFor(openingFor('RECORDED'))).courseProgress('c1', 's1');
        assert.equal(out.contentType, 'RECORDED');
    });

    test('a live course reports LIVE and keeps its schedule visible', async () => {
        const out = await lessons(prismaFor(openingFor('LIVE'))).courseProgress('c1', 's1');
        assert.equal(out.contentType, 'LIVE');
        // The two travel together: a live course's schedule is what replaces the
        // video player, so it must not be emptied by the type being reported.
        assert.equal(out.meetLink, 'https://meet.google.com/room-1');
    });

    test('a course row with no type falls back to LIVE rather than breaking the player', async () => {
        const out = await lessons(prismaFor({ ...openingFor('LIVE'), course: {} })).courseProgress('c1', 's1');
        assert.equal(out.contentType, 'LIVE');
    });

    test('an applicant who is not admitted still gets a type, and still gets no room', async () => {
        const prisma = {
            ...prismaFor(openingFor('RECORDED')),
            course: { findUnique: () => Promise.resolve({ contentType: 'RECORDED' }) },
            enrollment: {
                findUnique: () => Promise.resolve({ id: 'e1', status: 'PENDING', openingId: 'o1' }),
            },
        };
        const out = await lessons(prisma).courseProgress('c1', 's1');
        assert.equal(out.contentType, 'RECORDED');
        assert.equal(out.meetLink, null);
        assert.deepEqual(out.liveSessions, []);
    });
});

describe('LiveSessionsService refuses to schedule a meeting for a recorded course', () => {
    test('the write never happens', async () => {
        let created = false;
        const prisma = {
            course: { findUnique: () => Promise.resolve({ contentType: 'RECORDED' }) },
            liveSession: { create: () => { created = true; return Promise.resolve({}); } },
        };
        const svc = new LiveSessionsService(
            prisma as any,
            { assertCanManageOpening: () => Promise.resolve({ id: 'o1', courseId: 'c1' }) } as any,
            { logAction: () => Promise.resolve() } as any,
        );
        await assert.rejects(
            () => svc.create('o1', { titleAr: 'أ', titleEn: 'A', scheduledAt: '2026-10-07' } as any, 'i1', 'INSTRUCTOR' as any),
            BadRequestException,
        );
        assert.equal(created, false);
    });

    test('a live course is scheduled as before', async () => {
        let data: any;
        const prisma = {
            course: { findUnique: () => Promise.resolve({ contentType: 'LIVE' }) },
            liveSession: { create: (args: any) => { data = args.data; return Promise.resolve({ id: 's1' }); } },
        };
        const svc = new LiveSessionsService(
            prisma as any,
            { assertCanManageOpening: () => Promise.resolve({ id: 'o1', courseId: 'c1' }) } as any,
            { logAction: () => Promise.resolve() } as any,
        );
        await svc.create('o1', { titleAr: 'أ', titleEn: 'A', scheduledAt: '2026-10-07' } as any, 'i1', 'INSTRUCTOR' as any);
        assert.equal(data.openingId, 'o1');
    });
});
