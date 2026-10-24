import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * The route-prefix half of the boundary: `/admin/*` (and the `/api/admin/*`
 * spelling the plan reserves for the moved routes) only answers requests
 * carrying an admin-audience access token.
 *
 * Why it verifies the token itself instead of reading `req.user`:
 * global guards run BEFORE the route-level JwtAuthGuard, so at this point
 * nothing has authenticated the request yet. Reading the claim here is the
 * cheap pre-check -- it has to be, because the boundary must not depend on
 * each admin controller remembering to mount a guard. It deliberately does
 * not do the full user/tv lookup: that remains JwtStrategy's job later in
 * the same request, so a revoked session or a demoted role is still caught
 * by the authoritative check even if this one passes.
 *
 * Phase 2 is additive: no `/admin` path exists yet, so this guard is inert
 * until routes move there (Phase 3). It fires on prefix alone, which is why
 * `/enrollments/admin` -- an existing endpoint whose path merely ends in
 * "admin" -- is not matched.
 */
const ADMIN_PATH = /^\/(api\/)?admin(\/|$)/;

@Injectable()
export class AdminBoundaryGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const path = (req.path || req.url || '').split('?')[0];

        if (!ADMIN_PATH.test(path)) {
            return true;
        }

        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (!token) {
            throw new UnauthorizedException('Admin area requires authentication');
        }

        let payload: any;
        try {
            // Same pins as JwtStrategy: HS256 only, no algorithm taken from
            // the token's own header, expiration honoured.
            payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
        } catch {
            throw new UnauthorizedException('Invalid admin token');
        }

        // Short-lived single-purpose tokens (2FA challenge, forced password
        // change, operations grant) are not access tokens and are never
        // audience-stamped, but check the marker explicitly so a future
        // purpose token that did carry `aud` still cannot slip through.
        if (payload.purpose || payload.opsGrant === true) {
            throw new UnauthorizedException('This token cannot be used as an access token');
        }

        if (payload.aud !== 'admin') {
            throw new ForbiddenException('Admin area requires an admin-audience token');
        }

        return true;
    }
}
