import { join, resolve, sep } from 'path';
import { existsSync } from 'fs';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

/**
 * Resolve a private-upload DB key to an absolute filesystem path.
 *
 * Recognized keys (both the legacy location and the new private area):
 *   /uploads/receipts/<file>          -> uploads/receipts/<file>      (legacy)
 *   /uploads/cvs/<file>               -> uploads/cvs/<file>           (legacy)
 *   /uploads/private/receipts/<file>  -> uploads/private/receipts/<file>
 *   /uploads/private/cvs/<file>       -> uploads/private/cvs/<file>
 *
 * These files are NEVER served by the public GET /uploads/* routes; they are
 * only reachable through the authenticated download endpoints in the
 * Enrollments / InstructorApplications controllers, which enforce who may
 * view the row the key belongs to.
 */
export function resolvePrivateUpload(dbKey: string, kinds: string[]): string {
    const uploadsRoot = resolve(join(process.cwd(), 'uploads'));

    for (const kind of kinds) {
        const privatePrefix = `/uploads/private/${kind}/`;
        const legacyPrefix = `/uploads/${kind}/`;

        if (dbKey.startsWith(privatePrefix) || dbKey.startsWith(legacyPrefix)) {
            const rel = dbKey.slice((dbKey.startsWith(privatePrefix) ? privatePrefix : legacyPrefix).length);
            if (!rel || rel.includes('..') || rel.includes('\\') || rel.includes('/')) {
                throw new ForbiddenException('Invalid file key');
            }

            const base = resolve(join(uploadsRoot, dbKey.startsWith(privatePrefix) ? sep + 'private' : '', kind));
            const abs = resolve(join(base, rel));
            if (!abs.startsWith(base + sep)) {
                throw new ForbiddenException('Invalid file key');
            }
            if (!existsSync(abs)) {
                throw new NotFoundException('File not found');
            }
            return abs;
        }
    }

    throw new NotFoundException('File key not recognized');
}