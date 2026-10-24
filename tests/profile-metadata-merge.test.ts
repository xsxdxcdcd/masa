import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UsersService } from '../src/users/users.service';

/**
 * How `PATCH /users/me` merges `metadata`.
 *
 * The service spreads the *sanitised* payload over the stored value, and
 * `sanitizeProfileMetadata` keeps a key only when the trimmed value is
 * non-empty. That has two consequences, and only one of them is documented.
 *
 * Documented: omitting a key leaves it untouched. A dedicated instructor-CV
 * page can therefore PATCH just the CV fields and never clobber the phone,
 * country or academic record it does not know about.
 *
 * Also fixed here: an empty string used to be dropped by the sanitiser, which
 * let the stored value fall back through the merge and made the field
 * impossible to delete -- a teacher on a page built for editing a CV erased a
 * wrong job title, hit save, and watched it return. An explicitly empty value
 * now clears, which is what PATCH means. `avatarUrl` already worked this way,
 * so the two now agree.
 */
describe('PATCH /users/me metadata merge', () => {
    const stored = () => ({
        id: 'u1',
        email: 'teacher@laxalab.test',
        role: 'INSTRUCTOR',
        isActive: true,
        passwordHash: 'hash',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        language: 'ar',
        emailVerifiedAt: null,
        mustChangePassword: false,
        twoFactorEnabled: false,
        metadata: {
            phone: '+966500000000',
            country: 'SA',
            bio: 'نبذة قديمة',
            jobTitleAr: 'مدرس خطأ',
            avatarUrl: '/uploads/avatars/a.png',
        },
    });

    /** Runs the real `updateMe` and reports the metadata Prisma would store. */
    const patch = async (metadata: Record<string, unknown>) => {
        let written: Record<string, unknown> | undefined;
        const row = stored();
        const prisma = {
            user: {
                findUnique: async () => row,
                update: async (args: { data: { metadata?: Record<string, unknown> } }) => {
                    written = args.data.metadata;
                    return { ...row, metadata: written };
                },
            },
        };
        const service = new UsersService(prisma as never, { logAction: async () => {} } as never, { invalidate: async () => {} } as never);
        await service.updateMe('u1', { metadata } as never);
        return written as Record<string, unknown>;
    };

    test('a CV-only PATCH leaves the private profile fields alone', async () => {
        // This is what the dedicated instructor page sends.
        const after = await patch({ jobTitleEn: 'Senior Engineer', experienceYears: '7' });
        assert.equal(after.jobTitleEn, 'Senior Engineer');
        assert.equal(after.experienceYears, 7, 'the numeric string is coerced to a number');
        assert.equal(after.phone, '+966500000000', 'the phone must survive a CV edit');
        assert.equal(after.country, 'SA', 'the country must survive a CV edit');
    });

    test('an empty string clears the field', async () => {
        // The regression: erasing a wrong value has to actually erase it.
        const after = await patch({ bio: '', jobTitleAr: '' });
        assert.equal(after.bio, null);
        assert.equal(after.jobTitleAr, null);
    });

    test('an omitted key is left untouched, which is what makes a partial PATCH safe', async () => {
        const after = await patch({ jobTitleEn: 'Engineer' });
        assert.equal(after.jobTitleAr, 'مدرس خطأ', 'a field the payload never mentioned must survive');
        assert.equal(after.bio, 'نبذة قديمة');
    });

    test('experienceYears can be dropped again', async () => {
        assert.equal((await patch({ experienceYears: '7' })).experienceYears, 7);
        assert.equal((await patch({ experienceYears: '' })).experienceYears, null);
    });

    test('avatarUrl is cleared with an empty string too', async () => {
        const after = await patch({ avatarUrl: '' });
        assert.equal(after.avatarUrl, null);
    });

    test('values are trimmed and clamped', async () => {
        const after = await patch({ jobTitleEn: '  Engineer  ', bio: 'x'.repeat(600) });
        assert.equal(after.jobTitleEn, 'Engineer');
        assert.equal((after.bio as string).length, 500);
    });

    test('experienceYears is clamped to a believable range', async () => {
        assert.equal((await patch({ experienceYears: '9999' })).experienceYears, 80);
        assert.equal((await patch({ experienceYears: 4.6 })).experienceYears, 5);
        // Junk is dropped rather than stored as NaN.
        assert.equal((await patch({ experienceYears: 'abc' })).experienceYears, undefined);
    });

    test('a null birthDate is a clear, not a malformed date', async () => {
        assert.equal((await patch({ birthDate: '' })).birthDate, null);
        // Junk in a present value is still refused rather than stored.
        assert.equal((await patch({ birthDate: '05/04/2001' })).birthDate, undefined);
    });
});