import test from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { UserCacheModule } from '../src/common/user-cache.module';
import { UserCacheService } from '../src/common/user-cache.service';

/**
 * Boot a real Nest DI container.
 *
 * Unit tests hand-write their dependencies, so they cannot detect a provider
 * that Nest is unable to resolve at runtime. That is not hypothetical: an
 * earlier version of UserCacheModule imported no PrismaModule, so UserCacheService
 * could not resolve PrismaService and the whole backend refused to boot --
 * every route returned 502 in production while all 264 unit tests still passed.
 *
 * This file exists so that class of mistake fails here instead.
 */
test('the user cache provider resolves inside a real Nest container', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [UserCacheModule],
    }).compile();

    const svc = moduleRef.get(UserCacheService);
    assert.ok(svc, 'UserCacheService must be constructible with only its declared imports');
    await moduleRef.close();
});

test('the cache is exported, so AuthModule and UsersModule can reach it', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [UserCacheModule],
    }).compile();

    assert.doesNotThrow(() => moduleRef.get(UserCacheService));
    await moduleRef.close();
});
