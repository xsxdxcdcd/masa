import { Global, Module } from '@nestjs/common';
import { UserCacheService } from './user-cache.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Global because the cache is needed in three places that have no business
 * importing each other: JwtStrategy (reads), UsersService and AuthService
 * (invalidate). Making it global avoids a circular import between AuthModule and
 * UsersModule just to hand out one service.
 *
 * PrismaModule is imported explicitly: it is not itself @Global, so without
 * this the provider fails to resolve PrismaService at boot. Unit tests inject
 * hand-written mocks and so cannot catch that class of mistake -- it only
 * shows up in a real Nest container, i.e. in production.
 */
@Global()
@Module({
    imports: [PrismaModule],
    providers: [UserCacheService],
    exports: [UserCacheService],
})
export class UserCacheModule { }
