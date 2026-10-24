import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, CourseOpeningStatus } from '@prisma/client';
import type { CourseOpening } from '@prisma/client';

/**
 * The seat counter on CourseOpening is the single source of truth for capacity
 * ("maxStudents"). ALL enrollment paths must reserve a seat atomically through
 * claimSeat() so that concurrent registrations cannot oversubscribe the last
 * seat. claimSeat() runs a single conditional UPDATE: it only increments when
 * the opening has free seats, so two racing registrations can never both win.
 */

/** Raised by claimSeat() when the opening is at full capacity. */
export class CapacityConflictException extends ConflictException {
    constructor() {
        super('This course opening has reached its maximum number of students');
    }
}

export interface OpeningEligibility {
    /** Required opening lifecycle status (defaults to OPEN for enrollment). */
    requiredStatus?: CourseOpeningStatus;
    /** Require the opening to be published (student-facing flows). */
    requirePublished?: boolean;
    /** Whether an enrollmentDeadline that has passed blocks the reservation. */
    enforceDeadline?: boolean;
}

/**
 * Throws (400/409) when the opening is not yet reservable/registerable.
 * Pure read-only pre-check; the authoritative seat reservation happens in
 * claimSeat() inside the caller's transaction.
 */
export function assertOpeningEligible(opening: CourseOpening, opts?: OpeningEligibility) {
    const requiredStatus = opts?.requiredStatus ?? CourseOpeningStatus.OPEN;
    if (opening.status !== requiredStatus) {
        if (requiredStatus === CourseOpeningStatus.OPEN) {
            throw new BadRequestException('This course opening is not open for registration yet');
        }
        throw new BadRequestException(`This course opening must be in "${requiredStatus}" state for this action`);
    }

    if (opts?.requirePublished && !opening.isPublished) {
        throw new BadRequestException('This course opening is not published yet');
    }

    if (opts?.enforceDeadline && opening.enrollmentDeadline && opening.enrollmentDeadline < new Date()) {
        throw new ConflictException('The enrollment deadline for this course opening has passed');
    }

    if (opening.maxStudents !== null && opening.seatsTaken >= opening.maxStudents) {
        throw new CapacityConflictException();
    }
}

/**
 * Atomically reserve one seat. Must be called inside a $transaction and the
 * caller MUST pair it with releaseSeat() (or never leave the enrollment in a
 * holding state) when the enrollment is ultimately rejected/revoked.
 */
export async function claimSeat(tx: Prisma.TransactionClient, openingId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "CourseOpening"
        SET "seatsTaken" = "seatsTaken" + 1
        WHERE "id" = ${openingId}
          AND ("maxStudents" IS NULL OR "seatsTaken" < "maxStudents")
        RETURNING "id"`;
    if (rows.length === 0) {
        throw new CapacityConflictException();
    }
}

/**
 * Release a previously claimed seat (rejection, refund/revocation). Safe to
 * call even when the counter would go below zero; clamps at zero.
 */
export async function releaseSeat(tx: Prisma.TransactionClient, openingId: string): Promise<void> {
    await tx.$executeRaw`
        UPDATE "CourseOpening"
        SET "seatsTaken" = GREATEST("seatsTaken" - 1, 0)
        WHERE "id" = ${openingId}`;
}