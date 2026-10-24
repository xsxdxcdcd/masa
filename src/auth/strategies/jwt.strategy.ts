import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserCacheService } from '../../common/user-cache.service';
import { audienceForRole, permissionsForRole } from '../permissions/permissions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly userCache: UserCacheService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
            // Pin the algorithm instead of letting the token's own header pick it.
            // jsonwebtoken already rejects "none", but an allow-list means no
            // future header value can talk us into a different verification path
            // without someone editing this file on purpose.
            algorithms: ['HS256'],
        });
    }

    async validate(payload: any) {
        if (!payload.sub) {
            throw new UnauthorizedException('Invalid token payload');
        }

        // Short-lived single-purpose tokens are signed with the same secret
        // as access tokens: the 2FA challenge and the forced password change
        // carry `{sub, email, role, purpose}` and no `tv`. A `tv` that is
        // absent reads as 0, which matches the default tokenVersion, so for
        // an account that had never logged out such a token passed every
        // check below -- turning a 5-minute challenge token into a 5-minute
        // way around the 2FA it was issued to satisfy. The operations grant
        // is the same shape with `opsGrant` instead of `purpose`, and it is
        // likewise never presented as a Bearer token by this codebase (it
        // travels in `x-ops-grant`). Neither is an access token.
        if (payload.purpose || payload.opsGrant === true) {
            throw new UnauthorizedException('This token cannot be used as an access token');
        }

        // Read the user so a suspended/deactivated account is denied immediately
        // and authorization uses the CURRENT role (not a stale JWT claim).
        //
        // Served from a short-lived Redis cache when one is configured, and from
        // the database otherwise. The cache never becomes the authorization
        // boundary: every path that changes the role, the active flag, or the
        // password deletes the entry, so a stale role cannot outlive the write
        // that changed it. The TTL is only a backstop.
        const user = await this.userCache.findActiveUser(payload.sub);
        if (!user) {
            throw new UnauthorizedException('Account is not available');
        }

        // Revocation. `tv` is stamped into every access token at sign time; a
        // logout, a password change, or a detected refresh-token replay bumps
        // the row's tokenVersion, so already-issued tokens stop matching. A
        // token minted before this claim existed has no `tv`, which reads as 0
        // -- the same default the column starts at -- so nothing is logged out
        // by deploying this.
        const tokenVersion = typeof payload.tv === 'number' ? payload.tv : 0;
        if (tokenVersion !== user.tokenVersion) {
            throw new UnauthorizedException('Session has been revoked');
        }

        // Permissions and audience are computed from the role in the row
        // above, not read from `payload.permissions` / `payload.aud`: the
        // claim is stamped at issue time and would be stale after a role
        // change or after an edit to the permission map. The claims still
        // travel in the token for the client's UI hints and for
        // AdminBoundaryGuard's prefix check, which has no database handle.
        return {
            userId: user.id,
            email: user.email,
            role: user.role,
            permissions: permissionsForRole(user.role),
            audience: audienceForRole(user.role),
        };
    }
}
