import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Bootstraps initial accounts for local development and one-time provisioning.
 *
 * SECURITY:
 * - No passwords are hardcoded in this file.
 * - Passwords come exclusively from environment variables (SEED_*_PASSWORD),
 *   which act as the secret store (e.g. Railway env vars / Secret Manager).
 * - When a password is absent, a cryptographically random one is generated;
 *   it is never printed and is only used to create a brand-new account.
 * - Never runs in production unless SEED_ALLOW_IN_PRODUCTION=true is set
 *   (start commands must NOT invoke this on deploy).
 */

interface SeedAccount {
    email: string;
    envKey: string;
    role: Role;
}

const accounts: SeedAccount[] = [
    { email: 'admin@laxalab.com', envKey: 'SEED_ADMIN_PASSWORD', role: Role.ADMIN },
    { email: 'finance@laxalab.com', envKey: 'SEED_FINANCE_PASSWORD', role: Role.FINANCE },
    { email: 'instructor@laxalab.com', envKey: 'SEED_INSTRUCTOR_PASSWORD', role: Role.INSTRUCTOR },
    { email: 'course.manager@laxalab.com', envKey: 'SEED_MANAGER_PASSWORD', role: Role.COURSE_MANAGER },
    { email: 'student@laxalab.com', envKey: 'SEED_STUDENT_PASSWORD', role: Role.STUDENT },
];

async function main() {
    if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_IN_PRODUCTION !== 'true') {
        console.log('Refusing to seed in production. Set SEED_ALLOW_IN_PRODUCTION=true only for a one-time bootstrap.');
        return;
    }

    console.log('Bootstrapping accounts (passwords from env only)...');

    for (const account of accounts) {
        const supplied = process.env[account.envKey];
        const existing = await prisma.user.findUnique({ where: { email: account.email } });

        if (existing) {
            if (supplied && supplied.length > 0) {
                const hash = await bcrypt.hash(supplied, 12);
                await prisma.user.update({ where: { email: account.email }, data: { role: account.role, passwordHash: hash } });
                console.log(`✔ ${account.email}: password rotated from env ${account.envKey} (role ${account.role})`);
            } else {
                await prisma.user.update({ where: { email: account.email }, data: { role: account.role } });
                console.log(`✔ ${account.email}: role ensured without touching password (set ${account.envKey} to rotate)`);
            }
        } else {
            const password = supplied && supplied.length > 0 ? supplied : randomBytes(18).toString('base64url');
            const hash = await bcrypt.hash(password, 12);
            await prisma.user.create({ data: { email: account.email, passwordHash: hash, role: account.role } });
            console.log(`✔ ${account.email}: created (role ${account.role}) — set ${account.envKey} to control its password`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });