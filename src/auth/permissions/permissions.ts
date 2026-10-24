import { Role } from '@prisma/client';

/**
 * The permission catalog.
 *
 * Phase 2 of the boundary split (docs/boundary-map-decision.md): authorization
 * stops being "role names on a route" and becomes "does this principal hold
 * this capability". Roles stay -- RolesGuard still runs -- but they are now
 * the source of a least-privilege grant rather than the check itself.
 *
 * Two rules govern every entry here:
 *
 *  1. A permission describes a PLATFORM-surface action ("review any refund"),
 *     never an ownership one ("my refund"). Learner routes that authorize by
 *     ownership (my grades, my submissions, my opening) must keep their role +
 *     ownership checks; stamping them with a permission would either grant the
 *     student a platform capability or break the route. See
 *     docs/permission-map.md for the Phase 4 rule.
 *
 *  2. The role sets are read off the existing @Roles decorators, not
 *     invented. Every role that can call a route today must hold the
 *     permission that route will be annotated with, or Phase 3 would be a
 *     silent privilege cut. The mapping is pinned by tests in
 *     tests/permission-model.test.ts.
 */
export const PERMISSIONS = {
    // --- identity -----------------------------------------------------------
    USERS_READ: 'users:read',
    USERS_WRITE: 'users:write',
    USERS_DELETE: 'users:delete',
    USERS_ROLE: 'users:role',

    // --- catalogue & delivery ----------------------------------------------
    COURSES_READ: 'courses:read',
    COURSES_WRITE: 'courses:write',
    COURSES_DELETE: 'courses:delete',
    OPENINGS_WRITE: 'openings:write',
    OPENINGS_DELETE: 'openings:delete',
    CONTENT_READ: 'content:read',
    CONTENT_WRITE: 'content:write',
    CONTENT_DELETE: 'content:delete',
    PATHS_WRITE: 'paths:write',
    GRADES_READ: 'grades:read',
    GRADES_WRITE: 'grades:write',
    CERTIFICATES_ISSUE: 'certificates:issue',
    CERTIFICATES_MANAGE: 'certificates:manage',
    ANALYTICS_READ: 'analytics:read',

    // --- enrolment ----------------------------------------------------------
    ENROLLMENTS_READ: 'enrollments:read',
    ENROLLMENTS_WRITE: 'enrollments:write',
    ENROLLMENTS_REVIEW: 'enrollments:review',

    // --- money --------------------------------------------------------------
    PAYMENTS_READ: 'payments:read',
    PAYMENTS_REFUND: 'payments:refund',
    PAYMENTS_SETTINGS: 'payments:settings',
    REFUNDS_REVIEW: 'refunds:review',
    FINANCE_READ: 'finance:read',
    FINANCE_WRITE: 'finance:write',

    // --- platform governance -------------------------------------------------
    AUDIT_READ: 'audit:read',
    SUPPORT_READ: 'support:read',
    SUPPORT_WRITE: 'support:write',
    NEWS_READ: 'news:read',
    NEWS_WRITE: 'news:write',
    BLOG_WRITE: 'blog:write',
    INSTRUCTORS_READ: 'instructors:read',
    INSTRUCTORS_REVIEW: 'instructors:review',
    GAMIFICATION_MANAGE: 'gamification:manage',
    OPS_READ: 'ops:read',
    OPS_MANAGE: 'ops:manage',
    SYSTEM_READ: 'system:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/**
 * Which side of the boundary a token belongs to.
 *
 * `learner` = Student + Instructor, `admin` = Course Manager + Finance +
 * Admin (docs/architecture-boundaries.md section 3). Stamped as the `aud`
 * claim and enforced by AdminBoundaryGuard on /admin-prefixed paths.
 */
export type Audience = 'learner' | 'admin';

const LEARNER_ROLES: readonly string[] = [Role.STUDENT, Role.INSTRUCTOR];
const ADMIN_ROLES: readonly string[] = [Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN];

/**
 * Least-privilege grant per role.
 *
 * Derived from the @Roles decorators as they exist today (see the catalog
 * rules above). The two lists that matter most are disjoint by construction:
 *
 *  - COURSE_MANAGER owns the catalogue (courses, content, grades, support)
 *    and never sees money, the audit log, or role assignment.
 *  - FINANCE owns the money (payments, refunds, coupons, review queues) and
 *    never sees course authoring, grades, or user administration.
 *
 * ADMIN is every permission in the catalog rather than a hand-maintained
 * list, so a new catalog entry is automatically available to the superuser
 * and there is no "added a permission, forgot ADMIN" failure mode.
 */
const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
    [Role.STUDENT]: [],

    // Teaching staff: deliver and assess inside courses they are attached to.
    // Course creation, moderation and money stay outside this list.
    [Role.INSTRUCTOR]: [
        PERMISSIONS.OPENINGS_WRITE,
        PERMISSIONS.CONTENT_READ,
        PERMISSIONS.CONTENT_WRITE,
        PERMISSIONS.CONTENT_DELETE,
        PERMISSIONS.GRADES_READ,
        PERMISSIONS.GRADES_WRITE,
        PERMISSIONS.CERTIFICATES_ISSUE,
        PERMISSIONS.ANALYTICS_READ,
    ],

    // Administration side: owns the catalogue and the people/process surface,
    // with no access to payments, refunds, finance or the audit log.
    [Role.COURSE_MANAGER]: [
        PERMISSIONS.USERS_READ,
        PERMISSIONS.COURSES_READ,
        PERMISSIONS.COURSES_WRITE,
        PERMISSIONS.COURSES_DELETE,
        PERMISSIONS.OPENINGS_WRITE,
        PERMISSIONS.OPENINGS_DELETE,
        PERMISSIONS.CONTENT_READ,
        PERMISSIONS.CONTENT_WRITE,
        PERMISSIONS.CONTENT_DELETE,
        PERMISSIONS.PATHS_WRITE,
        PERMISSIONS.GRADES_READ,
        PERMISSIONS.GRADES_WRITE,
        PERMISSIONS.CERTIFICATES_ISSUE,
        PERMISSIONS.CERTIFICATES_MANAGE,
        PERMISSIONS.ENROLLMENTS_READ,
        PERMISSIONS.ENROLLMENTS_WRITE,
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.SUPPORT_READ,
        PERMISSIONS.SUPPORT_WRITE,
        PERMISSIONS.NEWS_READ,
        PERMISSIONS.NEWS_WRITE,
        PERMISSIONS.BLOG_WRITE,
        PERMISSIONS.INSTRUCTORS_READ,
        PERMISSIONS.INSTRUCTORS_REVIEW,
    ],

    // Money only: no catalogue, no grades, no user administration, no audit.
    [Role.FINANCE]: [
        PERMISSIONS.ENROLLMENTS_READ,
        PERMISSIONS.ENROLLMENTS_REVIEW,
        PERMISSIONS.PAYMENTS_READ,
        PERMISSIONS.PAYMENTS_REFUND,
        PERMISSIONS.REFUNDS_REVIEW,
        PERMISSIONS.FINANCE_READ,
        PERMISSIONS.FINANCE_WRITE,
    ],

    [Role.ADMIN]: ALL_PERMISSIONS,
};

/**
 * Current permissions for a role, read from the database row rather than
 * from the token's claim: a demotion or a change to the map itself takes
 * effect on the next request instead of when the token expires.
 *
 * An unknown role (a value added to the database before this map knew about
 * it) resolves to no permissions at all -- fail closed, never fail open.
 */
export function permissionsForRole(role: string): Permission[] {
    const granted = ROLE_PERMISSIONS[role as Role];
    return granted ? [...granted] : [];
}

/**
 * Boundary side for the `aud` claim. Both lookups are explicit about the
 * unknown case: a role this build does not recognize is placed on the
 * learner side, which is the side `/admin` paths reject.
 */
export function audienceForRole(role: string): Audience {
    if (LEARNER_ROLES.includes(role)) return 'learner';
    if (ADMIN_ROLES.includes(role)) return 'admin';
    return 'learner';
}
