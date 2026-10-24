import { DeliveryMode, EnrollmentStatus } from '@prisma/client';

/**
 * The one place that decides whether a student may see a classroom link.
 *
 * `LessonsService` and `EnrollmentsService` each had their own copy of this
 * rule, and the live-session schedule is a third reader of the same columns.
 * Three copies is three chances to ship a link to somebody who has not paid,
 * so the rule lives here and the two services call it.
 *
 * The rule: a room is shown only to an APPROVED enrollment in an ONLINE batch.
 * A REJECTED / REVOKED student keeps their history row but loses the link, and
 * a batch taught in person never carries one.
 */

export type ClassroomBatch = {
    deliveryMode: DeliveryMode | null | undefined;
    meetLink: string | null | undefined;
};

/** A session as stored; `meetLink` is optional and falls back to the batch's. */
export type ClassroomSessionRow = {
    id: string;
    titleAr: string;
    titleEn: string;
    scheduledAt: Date;
    durationMinutes: number | null;
    meetLink: string | null;
};

/** A session as served to a student: the link is already resolved. */
export type ClassroomSession = ClassroomSessionRow & {
    /** False when the link was inherited from the batch rather than its own. */
    hasOwnLink: boolean;
};

export type Classroom = {
    deliveryMode: DeliveryMode | null;
    meetLink: string | null;
    liveSessions: ClassroomSession[];
};

const EMPTY: Classroom = { deliveryMode: null, meetLink: null, liveSessions: [] };

/**
 * @param enrollmentStatus the student's enrollment status for this batch
 * @param batch            the batch's delivery mode + room, or null if there is none
 * @param sessions         the batch's scheduled sessions, in any order
 */
export function resolveClassroom(
    enrollmentStatus: EnrollmentStatus | string | null | undefined,
    batch: ClassroomBatch | null | undefined,
    sessions: readonly ClassroomSessionRow[] = [],
): Classroom {
    if (enrollmentStatus !== EnrollmentStatus.APPROVED || !batch) return EMPTY;

    const online = batch.deliveryMode === DeliveryMode.ONLINE;
    // The schedule itself is not a secret (dates and titles), so an approved
    // student sees it in person too -- but there is no room to join.
    const inherited = online ? batch.meetLink ?? null : null;

    return {
        deliveryMode: online ? DeliveryMode.ONLINE : null,
        meetLink: inherited,
        liveSessions: sessions
            .map((s) => {
                const own = s.meetLink ?? null;
                return { ...s, meetLink: online ? own ?? inherited : null, hasOwnLink: own !== null };
            })
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
    };
}