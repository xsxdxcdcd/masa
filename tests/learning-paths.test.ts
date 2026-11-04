import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { LearningPathsService } from '../src/learning-paths/learning-paths.service';

const audit = { logAction: async () => {} } as never;

describe('learning path visibility and course selection', () => {
    test('published path listings include their selected courses', async () => {
        let query: any;
        const prisma = {
            learningPath: {
                findMany: async (args: any) => {
                    query = args;
                    return [];
                },
            },
        };
        const service = new LearningPathsService(prisma as never, audit);

        await service.listPaths(true);

        assert.deepEqual(query.where, { isPublished: true });
        assert.deepEqual(query.include.courses.orderBy, { orderIndex: 'asc' });
        assert.equal(query.include.courses.where, undefined);
    });

    test('creating a path preserves the selected course order and publication state', async () => {
        let created: any;
        const prisma = {
            course: { count: async () => 2 },
            learningPath: {
                create: async (args: any) => {
                    created = args.data;
                    return { id: 'path-1', ...args.data };
                },
            },
        };
        const service = new LearningPathsService(prisma as never, audit);

        await service.createPath({
            titleAr: 'فريق أحمر',
            titleEn: 'Red Team',
            isPublished: true,
            courseIds: ['course-2', 'course-1'],
        }, 'admin-1');

        assert.equal(created.isPublished, true);
        assert.deepEqual(created.courses.create, [
            { courseId: 'course-2', orderIndex: 0 },
            { courseId: 'course-1', orderIndex: 1 },
        ]);
    });

    test('a path cannot reference missing courses', async () => {
        let createCalled = false;
        const prisma = {
            course: { count: async () => 1 },
            learningPath: {
                create: async () => {
                    createCalled = true;
                    return {};
                },
            },
        };
        const service = new LearningPathsService(prisma as never, audit);

        await assert.rejects(
            () => service.createPath({
                titleAr: 'مسار',
                titleEn: 'Path',
                courseIds: ['course-1', 'missing-course'],
            }, 'admin-1'),
            BadRequestException,
        );
        assert.equal(createCalled, false);
    });
});
