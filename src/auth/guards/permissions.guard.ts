import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * The permission half of authorization. Runs after JwtAuthGuard (same
 * @UseGuards list), so `req.user.permissions` is the set JwtStrategy just
 * resolved from the CURRENT database role -- never the token's claim.
 *
 * Semantics are deliberately asymmetric:
 *
 *  - No @RequirePermissions anywhere on the handler or class -> allow. The
 *    route is authorized by RolesGuard and/or service-level ownership, and
 *    this guard has nothing to say. This is what keeps Phase 2 additive.
 *
 *  - @RequirePermissions present but no resolved user/permissions -> DENY.
 *    A route that declared a requirement and got no answer fails closed; the
 *    only way to reach it is to actually satisfy it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!required || required.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        const granted: string[] | undefined = user?.permissions;

        if (!granted) {
            throw new ForbiddenException('Permissions could not be resolved for this request');
        }

        const missing = required.filter((permission) => !granted.includes(permission));
        if (missing.length > 0) {
            throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
        }

        return true;
    }
}
