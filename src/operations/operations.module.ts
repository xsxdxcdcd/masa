import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { AdminOperationsController } from './admin-operations.controller';
import { OperationsService } from './operations.service';
import { OperationsKeyService, OperationsTrackerMiddleware } from './operations-tracker.middleware';
import { OperationsQueriesService } from './operations-queries.service';
import { OperationsSettingsService } from './operations-settings.service';

/**
 * The tracker is registered as middleware rather than a global interceptor so it
 * runs for EVERY route, including ones with no controller and the static
 * upload handler. An interceptor would skip those and the device log would have
 * holes exactly where a scanner probes.
 */
@Module({
    controllers: [OperationsController, AdminOperationsController],
    providers: [
        OperationsService,
        OperationsKeyService,
        OperationsQueriesService,
        OperationsSettingsService,
        OperationsTrackerMiddleware,
    ],
    exports: [OperationsService, OperationsSettingsService],
})
export class OperationsModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(OperationsTrackerMiddleware).forRoutes('*');
    }
}
