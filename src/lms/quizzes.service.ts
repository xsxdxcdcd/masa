import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService, private gamification: GamificationService) {}

  private stripAnswers(quiz: any) {
    if (!quiz) return quiz;
    const { questions, ...rest } = quiz;
    return {
      ...rest,
      questions: (questions ?? []).map((q: any) => {
        const { correctIndex, ...publicQuestion } = q;
        // `parseCorrectIndices` also reads the answer out of
        // `options[i].isCorrect`, so dropping only `correctIndex` left the key
        // sitting in the payload of a fully public GET /lms/quizzes/:id. Any
        // quiz authored in that shape was anonymously solvable.
        if (Array.isArray(publicQuestion.options)) {
          publicQuestion.options = publicQuestion.options.map((opt: any) => {
            if (opt && typeof opt === 'object' && 'isCorrect' in opt) {
              const { isCorrect, ...restOpt } = opt;
              return restOpt;
            }
            return opt;
          });
        }
        return publicQuestion;
      }),
    };
  }

  async create(data: any) {
    const { questions = [], courseId, moduleId, ...quizData } = data;
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (moduleId) {
      const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod || mod.courseId !== courseId) throw new BadRequestException('Module does not belong to this course');
    }
    return this.prisma.quiz.create({
      data: {
        ...quizData,
        courseId,
        moduleId: moduleId || null,
        questions: {
          create: questions.map((q: any, i: number) => ({ ...q, moduleId: undefined, courseId: undefined, orderIndex: q.orderIndex ?? i })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async update(id: string, data: any) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const { questions, courseId, moduleId, ...quizData } = data;
    if (Array.isArray(questions)) {
      await this.prisma.$transaction([
        this.prisma.quizQuestion.deleteMany({ where: { quizId: id } }),
        this.prisma.quiz.update({
          where: { id },
          data: {
            ...quizData,
            moduleId: moduleId !== undefined ? (moduleId || null) : quiz.moduleId,
            questions: { create: questions.map((q: any, i: number) => ({ ...q, orderIndex: q.orderIndex ?? i })) },
          },
        }),
      ]);
    } else {
      await this.prisma.quiz.update({
        where: { id },
        data: { ...quizData, moduleId: moduleId !== undefined ? (moduleId || null) : quiz.moduleId },
      });
    }
    return this.prisma.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { orderIndex: 'asc' } } } });
  }

  async remove(id: string) {
    await this.prisma.quiz.delete({ where: { id } });
    return { ok: true };
  }

  async listByCourse(courseId: string, includeUnpublished: boolean) {
    return this.prisma.quiz.findMany({
      where: { courseId, ...(includeUnpublished ? {} : { isPublished: true }) },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getPublic(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException('Quiz not found');
    return this.stripAnswers(quiz);
  }

  async myAttempt(quizId: string, studentId: string) {
    const [attempt] = await this.prisma.quizAttempt.findMany({
      where: { quizId, enrollment: { studentId } },
      orderBy: { score: 'desc' },
      take: 1,
    });
    return attempt ?? null;
  }

  private parseCorrectIndices(question: any): number[] {
    const indices = new Set<number>();
    if (question.correctIndex !== null && question.correctIndex !== undefined) indices.add(Number(question.correctIndex));
    const options = Array.isArray(question.options) ? question.options : [];
    options.forEach((opt: any, i: number) => {
      if (opt && typeof opt === 'object' && opt.isCorrect) indices.add(i);
    });
    return [...indices].sort();
  }

  private scoreQuiz(quiz: any, answers: any[]) {
    let correct = 0;
    const total = quiz.questions.length;
    const details = quiz.questions.map((question: any) => {
      const answer = answers.find((a: any) => a.questionId === question.id);
      const selected: number[] = Array.isArray(answer?.selected) ? answer.selected.map(Number) : [];
      const correctSet = this.parseCorrectIndices(question);
      const isCorrect = correctSet.length > 0 && JSON.stringify([...selected].sort()) === JSON.stringify(correctSet);
      if (isCorrect) correct += 1;
      // `isCorrect` is feedback a student is entitled to. `correctAnswer` is
      // the key: returning it let anyone submit dummy answers, read the
      // correct indices out of the response and resubmit for 100%, which
      // defeats passScore (gating module completion) and the quiz_perfect /
      // quiz_master awards. Grading still uses correctSet internally; only the
      // per-question breakdown is withheld.
      return { questionId: question.id, isCorrect };
    });
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);
    return { score, passed: score >= quiz.passScore, details };
  }

  async attempt(quizId: string, enrollmentId: string, answers: any[], studentId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException('Quiz not found');

    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.studentId !== studentId) throw new ForbiddenException('Not your enrollment');
    if (enrollment.courseId !== quiz.courseId) throw new BadRequestException('Quiz does not belong to this course');

    const result = this.scoreQuiz(quiz, answers);
    const existing = await this.prisma.quizAttempt.findUnique({
      where: { quizId_enrollmentId: { quizId, enrollmentId } },
    });
    const bestScore = existing ? Math.max(existing.score, result.score) : result.score;
    const passed = bestScore >= quiz.passScore;

    const attempt = await this.prisma.quizAttempt.upsert({
      where: { quizId_enrollmentId: { quizId, enrollmentId } },
      update: { score: bestScore, passed, answers: answers as object },
      create: { quizId, enrollmentId, score: result.score, passed: result.passed, answers: answers as object },
    });

    if (result.passed) {
      try {
        await this.gamification.addPoints(studentId, result.score === 100 ? 'quiz_perfect' : 'quiz_pass');
      } catch {}
    }

    return { attempt, score: bestScore, passed, details: result.details };
  }
}