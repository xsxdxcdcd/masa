/**
 * Integration test for courses.service.update() partial-update semantics.
 *
 * Safety: the WHOLE test runs inside a single interactive Prisma transaction
 * and always throws at the end, so PostgreSQL ROLLS BACK everything — no
 * residue is ever written to the database. It is safe to run against the
 * production DB.
 *
 * Run:  INTEGRATION_TEST=1 npx ts-node tests/course-partial-update.integration.ts
 */
import { PrismaClient, Prisma, Role } from '@prisma/client';
import { CoursesService } from '../src/courses/courses.service';

if (!process.env.INTEGRATION_TEST) {
  console.error('Refusing to run without INTEGRATION_TEST=1');
  process.exit(2);
}

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        // A minimal prisma-like object so CoursesService talks to the SAME
        // transaction (so a rollback covers every write it makes).
        const scopedPrisma = new Proxy({} as any, {
          get: (_target, prop) => (tx as any)[prop],
        });
        const svc = new CoursesService(scopedPrisma, {} as any, {} as any, {} as any);

        const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const instructor = await tx.user.create({
          data: { email: `test-instr-${suffix}@example.com`, passwordHash: 'x', role: Role.INSTRUCTOR, language: 'en' },
        });
        const student = await tx.user.create({
          data: { email: `test-student-${suffix}@example.com`, passwordHash: 'x', role: Role.STUDENT, language: 'en' },
        });

        const course = await svc.create(
          {
            titleAr: `عنوان تجريبي ${suffix}`,
            titleEn: `Test Course ${suffix}`,
            excerptAr: 'مقتطف',
            excerptEn: 'excerpt',
            modules: [
              { titleAr: 'درس 1', titleEn: 'Lesson 1', orderIndex: 0, durationMinutes: 10, outcomes: [{ descriptionAr: 'مخرجات 1', descriptionEn: 'Outcome 1' }], files: [{ url: '/uploads/courses/general/x.png' }], links: [{ url: 'https://example.com', labelAr: 'رابط', labelEn: 'Link' }] },
              { titleAr: 'درس 2', titleEn: 'Lesson 2', orderIndex: 1 },
            ],
            chapters: [{ titleAr: 'فصل 1', titleEn: 'Chapter 1', orderIndex: 0 }],
            objectives: [{ objectiveAr: 'هدف 1', objectiveEn: 'Objective 1', orderIndex: 0 }],
            prerequisites: [{ prerequisiteAr: 'متطلب 1', prerequisiteEn: 'Prereq 1', orderIndex: 0 }],
            audiences: [{ audienceAr: 'جمهور 1', audienceEn: 'Audience 1', orderIndex: 0 }],
            faqs: [{ questionAr: 'س؟', questionEn: 'Q?', answerAr: 'ج', answerEn: 'A', orderIndex: 0 }],
            gallery: [{ url: '/uploads/courses/general/g.png', altAr: 'صورة', altEn: 'img', orderIndex: 0 }],
          },
          instructor.id,
        );

        // Attach learning activity that would be destroyed by a cascading wipe.
        const m1 = await tx.module.findFirstOrThrow({ where: { courseId: course.id, titleEn: 'Lesson 1' } });
        const chapter = await tx.chapter.findFirstOrThrow({ where: { courseId: course.id } });
        const m3 = await tx.module.create({ data: { titleAr: 'درس 3', titleEn: 'Lesson 3', orderIndex: 0, courseId: course.id, chapterId: chapter.id } });
        const enrollment = await tx.enrollment.create({ data: { studentId: student.id, courseId: course.id } });
        await tx.lessonProgress.create({ data: { enrollmentId: enrollment.id, moduleId: m1.id } });
        await tx.lessonNote.create({ data: { enrollmentId: enrollment.id, moduleId: m3.id, content: 'note' } });
        const quiz = await tx.quiz.create({ data: { titleAr: 'اختبار', titleEn: 'Quiz', courseId: course.id, moduleId: m1.id } });
        await tx.quizAttempt.create({ data: { quizId: quiz.id, enrollmentId: enrollment.id, score: 50, passed: false, answers: [] } });

        async function counts() {
          return {
            modules: await tx.module.count({ where: { courseId: course.id } }),
            chapters: await tx.chapter.count({ where: { courseId: course.id } }),
            outcomes: await tx.learningOutcome.count({ where: { module: { courseId: course.id } } }),
            objectives: await tx.courseObjective.count({ where: { courseId: course.id } }),
            prerequisites: await tx.coursePrerequisite.count({ where: { courseId: course.id } }),
            audiences: await tx.courseAudience.count({ where: { courseId: course.id } }),
            faqs: await tx.courseFaq.count({ where: { courseId: course.id } }),
            gallery: await tx.courseImage.count({ where: { courseId: course.id } }),
            progress: await tx.lessonProgress.count({ where: { enrollment: { courseId: course.id } } }),
            notes: await tx.lessonNote.count({ where: { enrollment: { courseId: course.id } } }),
            attempts: await tx.quizAttempt.count({ where: { enrollment: { courseId: course.id } } }),
          };
        }

        const before = await counts();

        // === THE REGRESSION: update only the title (partial patch) ===
        await svc.update(course.id, { titleAr: 'عنوان محدّث جزئياً' });

        const after = await counts();
        const updated = await tx.course.findUniqueOrThrow({ where: { id: course.id }, select: { titleAr: true } });

        assert(updated.titleAr === 'عنوان محدّث جزئياً', 'title should be updated');
        for (const key of Object.keys(before) as (keyof typeof before)[]) {
          assert(after[key] === before[key], `${key} changed after partial update: ${before[key]} -> ${after[key]}`);
        }
        console.log('[partial] title-only update preserved all content + progress + notes + attempts');

        // === Explicit replace must STILL work (intended behavior) ===
        await svc.update(course.id, { modules: [{ titleAr: 'درس جديد', titleEn: 'New Lesson', durationMinutes: 30 }] });
        const afterReplace = await counts();
        assert(afterReplace.modules === 1, `explicit modules replace should yield 1 module, got ${afterReplace.modules}`);
        assert(afterReplace.chapters === 1, 'replacing modules alone must NOT delete chapters (partial semantics)');
        assert(afterReplace.objectives === 1, 'replacing modules alone must NOT delete objectives (partial semantics)');
        assert(afterReplace.progress === 0, 'progress on removed modules should cascade-delete on explicit replace');
        assert(afterReplace.notes === 0, 'notes on removed modules should cascade-delete on explicit replace');
        assert(afterReplace.attempts === 0, 'attempts on removed modules should cascade-delete on explicit replace');
        console.log('[explicit] modules replaced to 1; chapters/objectives preserved; progress/notes/attempts cascade-deleted as designed');

        console.log('INTEGRATION TEST PASSED (rolled back, no DB residue)');
        throw new Error('__ROLLBACK__');
      },
      { timeout: 30000 },
    );
  } catch (e: any) {
    if (e?.message === '__ROLLBACK__') {
      console.log('ALL CLEAN: transaction rolled back.');
      await prisma.$disconnect();
      process.exit(0);
    }
    await prisma.$disconnect();
    console.error(e);
    process.exit(1);
  }
}

main();