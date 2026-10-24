import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches `req.user` when a valid JWT is supplied, but never rejects the
 * request.
 *
 * Public endpoints that widen their result set for staff (for example
 * `GET /courses?includeUnpublished=true`) read `req.user.role` to decide
 * whether unpublished rows may be returned. Without this guard nothing
 * populates `req.user` on those routes, so the staff-only branch was
 * silently dead and drafts stayed invisible to the people who manage them.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest<TUser = unknown>(err: unknown, user: unknown, info: unknown, context: ExecutionContext): TUser {
        if (err || !user) return undefined as TUser;
        context.switchToHttp().getRequest().user = user;
        return user as TUser;
    }
}
