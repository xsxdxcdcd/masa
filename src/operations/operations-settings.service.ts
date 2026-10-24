import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const SETTINGS_ID = 'singleton';

/** The owner asked for this; anything shorter is not worth hashing. */
const MIN_KEY_LENGTH = 12;
const MAX_KEY_LENGTH = 200;

export interface SettingsState {
    /** True once a password has been set in-app; false means the env var is in charge. */
    hasPassword: boolean;
    keyVersion: number;
    /** True when no allowlist entry exists, i.e. every admin with the key is in. */
    allowlistEmpty: boolean;
    allowlistSize: number;
}

/**
 * The operations center's credentials: the password, and who is allowed in.
 *
 * SECURITY NOTES, in the order they matter
 *
 * 1. THE KEY IS ONLY EVER COMPARED, NEVER STORED. `keyHash` is a bcrypt digest.
 *    A database dump must not open the operations door. The plain
 *    `OPERATIONS_KEY` env var remains supported as a fallback so the page keeps
 *    working before anyone sets a password here, but it is the weaker of the two
 *    and the UI says so.
 *
 * 2. THE ENV FALLBACK IS ONLY CONSULTED WHEN NO PASSWORD HAS BEEN SET. Once
 *    `keyHash` exists the env var is ignored entirely. Otherwise an admin who
 *    rotated the password would still be reachable with the old env value --
 *    rotating would look like it worked while leaving a second door open.
 *
 * 3. bcrypt IS DELIBERATELY SLOW, WHICH IS A DoS SURFACE. `verifyKey` is the
 *    most expensive thing an unauthenticated-ish caller can reach, so the
 *    controller rate limits it separately. When no in-app password exists the
 *    comparison is a cheap constant-time string compare instead, so the fallback
 *    path cannot be used to burn CPU.
 *
 * 4. KEY VERSION IS THE REVOCATION MECHANISM. Grants carry the version they
 *    were minted under; rotating the password bumps it and every outstanding
 *    grant stops verifying. Without this, "log out everywhere" would be a hope.
 */
@Injectable()
export class OperationsSettingsService {
    private readonly logger = new Logger(OperationsSettingsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /** Reads never throw on a missing row: the migration seeds it, but a fresh
     * database restored from a dump taken before the migration may not have it,
     * and the settings page must still render to explain that. */
    private async row() {
        const existing = await this.prisma.operationsSetting.findUnique({ where: { id: SETTINGS_ID } });
        if (existing) return existing;
        return this.prisma.operationsSetting.create({ data: { id: SETTINGS_ID, keyVersion: 1 } });
    }

    async state(): Promise<SettingsState> {
        const [row, size] = await Promise.all([
            this.row(),
            this.prisma.operationsAllowlistEntry.count(),
        ]);
        return {
            hasPassword: !!row.keyHash,
            keyVersion: row.keyVersion,
            allowlistEmpty: size === 0,
            allowlistSize: size,
        };
    }

    /**
     * Constant-time comparison for the env fallback.
     *
     * The length check cannot be avoided -- comparing buffers of different
     * lengths throws -- so a dummy comparison is burned to keep the early
     * return from becoming a timing oracle that reports the key's length.
     */
    private envKeyMatches(candidate: string): boolean {
        const expected = process.env.OPERATIONS_KEY;
        if (!expected) return false;
        const a = Buffer.from(candidate);
        const b = Buffer.from(expected);
        if (a.length !== b.length) {
            timingSafeEqual(b, b);
            return false;
        }
        return timingSafeEqual(a, b);
    }

    /**
     * Verify a candidate operations password.
     *
     * Returns false rather than throwing for every failure mode, so the caller
     * cannot accidentally branch on which kind of failure occurred.
     */
    async verifyKey(candidate: string | undefined): Promise<boolean> {
        if (!candidate || candidate.length < 1) return false;
        const row = await this.row();
        if (row.keyHash) {
            // The in-app password wins outright; see note 2 above.
            return bcrypt.compare(candidate, row.keyHash);
        }
        return this.envKeyMatches(candidate);
    }

    /** The version new grants should carry. */
    async currentKeyVersion(): Promise<number> {
        const row = await this.row();
        return row.keyVersion;
    }

    /**
     * Set or replace the operations password.
     *
     * Bumping `keyVersion` is the whole point: it invalidates every grant that
     * was already issued, so a grant captured before the change is worthless
     * afterwards. Returns the new version so the caller can tell the admin that
     * other unlocked tabs were signed out.
     */
    async setKey(newKey: string, actorId: string): Promise<number> {
        this.assertAcceptableKey(newKey);
        const keyHash = await bcrypt.hash(newKey, BCRYPT_ROUNDS);
        const row = await this.prisma.operationsSetting.upsert({
            where: { id: SETTINGS_ID },
            create: { id: SETTINGS_ID, keyHash, keyVersion: 2, changedById: actorId, migratedAt: new Date() },
            update: { keyHash, keyVersion: { increment: 1 }, changedById: actorId, migratedAt: new Date() },
        });
        this.logger.log(`operations password changed; grants now require keyVersion ${row.keyVersion}`);
        return row.keyVersion;
    }

    /**
     * Password strength, kept deliberately plain.
     *
     * Length is the only thing that really matters for a passphrase, and rules
     * that demand a symbol or reject a passphrase push people toward
     * `Password1!`. The floor is high enough that a short guess is not viable.
     */
    private assertAcceptableKey(key: string): void {
        if (typeof key !== 'string') throw new BadRequestException('Password required');
        if (key.length < MIN_KEY_LENGTH) {
            throw new BadRequestException(`The operations password must be at least ${MIN_KEY_LENGTH} characters`);
        }
        if (key.length > MAX_KEY_LENGTH) {
            throw new BadRequestException(`The operations password must be at most ${MAX_KEY_LENGTH} characters`);
        }
    }

    // ------------------------------------------------------------- allowlist

    /**
     * May this user open the operations page?
     *
     * Three conditions, all required:
     *   1. an allowlist entry exists, OR the allowlist is empty (owner has not
     *      narrowed it yet -- see the note on `assertNotLockingOut`),
     *   2. the account is still an active ADMIN,
     *   3. the account is not suspended.
     *
     * The role is read from the DATABASE, not from the JWT. A token minted
     * while someone was an admin still carries `role: ADMIN` after they are
     * demoted, so a JWT-only check would keep the door open until the token
     * expired. `isActive` matters for the same reason: a suspended admin's
     * outstanding tokens are not all revoked.
     */
    async isAllowed(userId: string): Promise<boolean> {
        const [user, entries] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, isActive: true },
            }),
            this.prisma.operationsAllowlistEntry.count(),
        ]);
        if (!user || user.role !== 'ADMIN' || !user.isActive) return false;
        if (entries === 0) return true;
        const entry = await this.prisma.operationsAllowlistEntry.findUnique({
            where: { userId },
            select: { id: true },
        });
        return !!entry;
    }

    /**
     * The allowlist, joined to the account each entry points at.
     *
     * The user's live `role` and `isActive` are returned alongside the entry
     * rather than assumed: an entry for someone who has since been demoted is
     * still a row in this table, and the UI has to show that as "listed, but no
     * longer an admin" instead of pretending the grant is working.
     */
    async listAllowlist() {
        const entries = await this.prisma.operationsAllowlistEntry.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                user: { select: { id: true, email: true, role: true, isActive: true } },
            },
        });
        return entries.map((e) => ({
            id: e.id,
            userId: e.userId,
            email: e.user.email,
            role: e.user.role,
            isActive: e.user.isActive,
            grantedById: e.grantedById,
            createdAt: e.createdAt,
            // Convenience flag for the UI: this row grants nothing right now.
            effective: e.user.role === 'ADMIN' && e.user.isActive,
        }));
    }

    /** Admin accounts not yet on the list, for the picker. */
    async listEligibleAdmins() {
        const [admins, entries] = await Promise.all([
            this.prisma.user.findMany({
                where: { role: 'ADMIN', isActive: true },
                select: { id: true, email: true },
                orderBy: { email: 'asc' },
            }),
            this.prisma.operationsAllowlistEntry.findMany({ select: { userId: true } }),
        ]);
        const onList = new Set(entries.map((e) => e.userId));
        return admins
            .filter((a) => !onList.has(a.id))
            .map((a) => ({ id: a.id, email: a.email }));
    }

    /**
     * The guard against locking the owner out forever.
     *
     * Adding the first entry is always fine. Removing one is refused when it
     * would empty the list, because an empty list is the "every admin" fallback,
     * and a *non-empty* list containing only admins the owner did not intend to
     * keep is the real trap -- whoever is left can be anyone. The escape hatch
     * is that clearing the list entirely is allowed and restores the fallback.
     *
     * An empty allowlist is therefore NOT a lockout: it means "any admin with the
     * password". That is the safe direction for a control whose failure mode is
     * locking yourself out of your own audit log with no way back.
     */
    private async assertNotLockingOut(nextCount: number): Promise<void> {
        if (nextCount > 0) return;
        throw new BadRequestException(
            'The last allowed admin cannot be removed. Clear the whole list instead to fall back to "any admin with the password".',
        );
    }

    async addToAllowlist(userId: string, actorId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, isActive: true },
        });
        if (!user) throw new NotFoundException('User not found');
        // Refuse to list a non-admin: it would look like it worked and silently
        // grant nothing, because `isAllowed` re-checks the role on every access.
        if (user.role !== 'ADMIN') {
            throw new BadRequestException('Only ADMIN accounts can be given access to the operations center');
        }
        if (!user.isActive) {
            throw new BadRequestException('That account is suspended');
        }
        const existing = await this.prisma.operationsAllowlistEntry.findUnique({ where: { userId } });
        if (existing) return { userId, alreadyPresent: true };
        await this.prisma.operationsAllowlistEntry.create({ data: { userId, grantedById: actorId } });
        return { userId, alreadyPresent: false };
    }

    async removeFromAllowlist(userId: string, actorId: string): Promise<{ removedSelf: boolean }> {
        const count = await this.prisma.operationsAllowlistEntry.count();
        await this.assertNotLockingOut(count - 1);
        const removed = await this.prisma.operationsAllowlistEntry.deleteMany({ where: { userId } });
        // Removing yourself is allowed while another admin remains, but it is
        // logged distinctly: the next person to open the page should know an
        // admin just narrowed the list they are standing behind.
        return { removedSelf: removed.count > 0 && userId === actorId };
    }

    /**
     * Deny explicitly when the caller is on the list but their role was revoked
     * after the fact, so the UI can say "you are an admin but no longer listed"
     * instead of the generic "locked".
     */
    async explainDenial(userId: string): Promise<'not-listed' | 'not-admin' | 'inactive' | null> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isActive: true },
        });
        if (!user) return 'not-admin';
        if (!user.isActive) return 'inactive';
        if (user.role !== 'ADMIN') return 'not-admin';
        const entries = await this.prisma.operationsAllowlistEntry.count();
        if (entries === 0) return null;
        const entry = await this.prisma.operationsAllowlistEntry.findUnique({ where: { userId }, select: { id: true } });
        return entry ? null : 'not-listed';
    }

    async assertAllowed(userId: string): Promise<void> {
        if (await this.isAllowed(userId)) return;
        throw new ForbiddenException('This account is not allowed to open the operations center');
    }
}
