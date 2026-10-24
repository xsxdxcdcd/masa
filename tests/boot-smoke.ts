/**
 * Compile the ENTIRE application in a real Nest DI container.
 *
 * The unit suite builds services by hand, so a provider that Nest cannot
 * resolve is invisible to it. On 2026-10-01 that shipped: every route answered
 * 502 because UserCacheService could not resolve PrismaService, while all 264
 * unit tests passed. This file makes the boot path itself the thing under test.
 *
 * AppModule is imported but never listened on, and no route is called, so this
 * touches no database rows and binds no port. PrismaService is overridden with
 * a stub so no real connection is attempted.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue({
            $connect: async () => undefined,
            $disconnect: async () => undefined,
            onModuleInit: async () => undefined,
            onModuleDestroy: async () => undefined,
            user: { findUnique: async () => null },
        })
        .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
    console.log('BOOT OK: every provider in AppModule resolved');
}

main().catch((err) => {
    console.error('BOOT FAILED:', err?.message ?? err);
    process.exit(1);
});
