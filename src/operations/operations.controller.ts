import { Body, Controller, ForbiddenException, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperationsService } from './operations.service';
import { TrackEventDto } from './dto/operations.dto';

const UNAUTHENTICATED_TRACKING = ['page_view', 'action'] as const;

/**
 * The operations center tracking endpoint.
 *
 * The tracking endpoint is public because it must capture anonymous visitors.
 * It accepts only a page view or a named action, writes only against the
 * caller's own cookie-identified session, and never accepts a session id from
 * the client -- otherwise anyone could write events into someone else's device.
 *
 * The admin half of the operations center (unlock, reads, settings) lives in
 * `AdminOperationsController` under `/api/admin/operations`, where the
 * AdminBoundaryGuard enforces the admin audience.
 */
@ApiTags('Operations Center')
@Controller('operations')
export class OperationsController {
    constructor(private readonly ops: OperationsService) { }

    /**
     * Page views and named UI actions. Public, because most traffic is anonymous
     * and the tracker runs before any session exists.
     */
    @Post('track')
    @ApiOperation({ summary: 'Record a page view or a named UI action' })
    async track(@Req() req: any, @Body() dto: TrackEventDto) {
        const sessionId = (req as { opsSessionId?: string | null }).opsSessionId;
        if (!sessionId) {
            // The middleware issues a cookie on the first request, so this only
            // happens when the tracker fires before any page load resolved.
            return { ok: true, skipped: true };
        }

        const isTracked = (UNAUTHENTICATED_TRACKING as readonly string[]).includes(dto.type);
        if (!isTracked) {
            // `api_call` and `security` are server-authored. Accepting them from
            // a browser would let anyone forge both.
            throw new ForbiddenException('This event type is recorded by the server only');
        }
        // Narrowed here because the DTO carries all four types; the guard above
        // is what makes the narrowing true rather than an unchecked assertion.
        const clientEvent = dto as { type: 'page_view' | 'action' };

        await this.ops.trackClientEvent(sessionId, clientEvent);
        if (dto.screen || dto.timezone) {
            await this.ops.enrichSession(sessionId, { screen: dto.screen, timezone: dto.timezone });
        }
        return { ok: true };
    }
}
