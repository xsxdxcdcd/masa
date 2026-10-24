import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
    imports: [
        PrismaModule,
        NotificationsModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET!,
            // Matches AuthModule. ChatGateway only *verifies* tokens, so this was
            // never used -- but it was 1 day, and anyone signing a token through
            // this module later would silently mint week-long access tokens.
            // Pinned to the same 15 minutes as every other access token.
            signOptions: { expiresIn: '15m' },
        }),
    ],
    controllers: [ChatController],
    providers: [ChatGateway, ChatService],
    exports: [ChatService],
})
export class ChatModule { }