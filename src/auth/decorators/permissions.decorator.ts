import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declare the capabilities a route requires.
 *
 * Pairs with PermissionsGuard, which must be in the same @UseGuards list as
 * JwtAuthGuard (it reads req.user, so it cannot be a global guard -- global
 * guards run before the route-level ones populate the request). The static
 * check in tests/permission-model.test.ts fails if a file uses this
 * decorator without registering the guard, because that combination would
 * silently enforce nothing.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
