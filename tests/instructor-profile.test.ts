import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    PROFILE_KEY,
    emptyInstructorProfile,
    readInstructorProfile,
    sanitizeInstructorProfile,
} from '../src/common/instructor-profile';
import { toPublicInstructor } from '../src/common/public-instructor';

const meta = (extra: Record<string, unknown>) => ({
    id: 'instructor-1',
    metadata: extra,
    createdAt: new Date('2024-01-01'),
});

describe('instructor profile sanitiser', () => {
    test('an absent section is left alone, not wiped', () => {
        // `sanitizeProfileMetadata` treats "key not mentioned" differently from
        // "mentioned and empty". Without that, an ordinary profile PATCH — one
        // that only knows about the phone number — would erase the whole CV.
        const out = sanitizeInstructorProfile(undefined);
        assert.deepEqual(out, emptyInstructorProfile());
    });

    test('an explicitly empty section clears', () => {
        const out = sanitizeInstructorProfile(null);
        assert.deepEqual(out.experiences, []);
        assert.equal(out.experienceYears, null);
    });

    test('bilingual text is trimmed, capped and split by language', () => {
        const out = sanitizeInstructorProfile({
            name: { ar: '  محمد علي  ', en: '  Mohammed Ali ' },
            jobTitle: { ar: 'مدرّس' },
            bio: { ar: 'نبذة', en: 'Bio' },
        });
        assert.equal(out.name.ar, 'محمد علي');
        assert.equal(out.name.en, 'Mohammed Ali');
        assert.equal(out.jobTitle.ar, 'مدرّس');
        assert.equal(out.jobTitle.en, null);
        assert.equal(out.bio.en, 'Bio');
    });

    test('a non-object section is rejected rather than stored', () => {
        assert.throws(() => sanitizeInstructorProfile('nope'));
        assert.throws(() => sanitizeInstructorProfile(['nope']));
    });

    test('years of experience is clamped, and a nonsense value is rejected', () => {
        assert.equal(sanitizeInstructorProfile({ experienceYears: 200 }).experienceYears, 80);
        assert.equal(sanitizeInstructorProfile({ experienceYears: '7' }).experienceYears, 7);
        assert.equal(sanitizeInstructorProfile({ experienceYears: '' }).experienceYears, null);
        assert.throws(() => sanitizeInstructorProfile({ experienceYears: 'lots' }));
        assert.throws(() => sanitizeInstructorProfile({ experienceYears: -1 }));
    });

    test('each list is capped, so a profile cannot grow without bound', () => {
        const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ar: `عنصر ${i}`, en: `item ${i}` }));
        assert.equal(sanitizeInstructorProfile({ specialties: many(50) }).specialties.length, 12);
        assert.equal(
            sanitizeInstructorProfile({
                experiences: many(50).map((_, i) => ({ role: `r${i}`, organisation: `o${i}` })),
            }).experiences.length,
            15,
        );
        assert.equal(
            sanitizeInstructorProfile({
                qualifications: many(50).map((_, i) => ({ degree: `d${i}` })),
            }).qualifications.length,
            10,
        );
        assert.equal(
            sanitizeInstructorProfile({ languages: many(50).map((_, i) => ({ name: `l${i}` })) }).languages.length,
            10,
        );
        assert.equal(
            sanitizeInstructorProfile({ certificates: many(50).map((_, i) => ({ title: `c${i}` })) }).certificates.length,
            15,
        );
    });

    test('a long string is cut instead of stored whole', () => {
        const out = sanitizeInstructorProfile({ bio: { ar: 'ا'.repeat(5000) } });
        assert.equal((out.bio.ar ?? '').length, 1200);
    });

    test('empty list entries are dropped rather than rendered as blanks', () => {
        const out = sanitizeInstructorProfile({
            specialties: [{ ar: 'رياضيات' }, { ar: '  ' }, { en: 'Physics' }, {}],
        });
        assert.deepEqual(out.specialties, [{ ar: 'رياضيات', en: null }, { ar: null, en: 'Physics' }]);
    });

    test('an experience needs a role and an organisation', () => {
        assert.throws(() => sanitizeInstructorProfile({ experiences: [{ organisation: 'جامعة' }] }));
        assert.throws(() => sanitizeInstructorProfile({ experiences: [{ role: 'مدرّس' }] }));
        const ok = sanitizeInstructorProfile({
            experiences: [{ role: 'مدرّس', organisation: 'جامعة الملك سعود', from: '2021', to: '2024', description: 'تدريس' }],
        });
        assert.equal(ok.experiences[0].organisation, 'جامعة الملك سعود');
        assert.equal(ok.experiences[0].to, '2024');
    });
});

describe('profile links are held to the classroom-link rule', () => {
    // These render into a real `href` on a page every visitor loads, so the
    // value must never be able to carry a script.
    test('http is refused', () => {
        assert.throws(() => sanitizeInstructorProfile({ links: [{ label: 'Site', url: 'http://x.test' }] }));
    });

    test('javascript: is refused', () => {
        assert.throws(() => sanitizeInstructorProfile({ links: [{ label: 'Site', url: 'javascript:alert(1)' }] }));
    });

    test('embedded credentials are refused', () => {
        assert.throws(() => sanitizeInstructorProfile({ links: [{ label: 'Site', url: 'https://a.test@evil.test' }] }));
    });

    test('a label is required', () => {
        assert.throws(() => sanitizeInstructorProfile({ links: [{ url: 'https://x.test' }] }));
    });

    test('https is accepted and normalised', () => {
        const out = sanitizeInstructorProfile({ links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/x' }] });
        assert.equal(out.links[0].url, 'https://linkedin.com/in/x');
        assert.equal(out.links[0].label, 'LinkedIn');
    });
});

describe('the public payload carries only what a student should see', () => {
    test('account and personal keys never appear', () => {
        // The whole reason the profile was namespaced: these live in the same
        // metadata bag and used to sit inside a profile-shaped object.
        const card = toPublicInstructor(
            meta({
                fullName: 'محمد',
                phone: '+966500000000',
                birthDate: '1990-01-01',
                gender: 'male',
                country: 'SA',
                city: 'Riyadh',
                university: 'KSU',
                email: 'teacher@laxalab.test',
            }),
        );
        const serialised = JSON.stringify(card);
        for (const leak of ['966500000000', '1990-01-01', 'Riyadh', 'KSU', 'teacher@laxalab.test']) {
            assert.equal(serialised.includes(leak), false, `leaked: ${leak}`);
        }
    });

    test('a phone number written inside publicProfile is still not projected', () => {
        // The namespaced shape has no `phone` field, so unknown keys are dropped
        // by the sanitiser rather than passed through.
        const card = toPublicInstructor(
            meta({
                phone: '+966500000000',
                [PROFILE_KEY]: { name: { ar: 'محمد' }, phone: '+966500000000', email: 'x@evil.test' },
            }),
        );
        assert.equal(JSON.stringify(card).includes('9665'), false);
        assert.equal(JSON.stringify(card).includes('evil.test'), false);
        assert.equal(card.nameAr, 'محمد');
    });

    test('structured sections reach the public card', () => {
        const card = toPublicInstructor(
            meta({
                [PROFILE_KEY]: sanitizeInstructorProfile({
                    name: { ar: 'سارة' },
                    jobTitle: { ar: 'مدرّسة فيزياء' },
                    specialties: [{ ar: 'فيزياء' }, { en: 'Astronomy' }],
                    experienceYears: 9,
                    experiences: [{ role: 'مدرّسة', organisation: 'مدرسة النخبة', from: '2019' }],
                    qualifications: [{ degree: 'ماجستير', institution: 'جامعة أم القرى' }],
                    languages: [{ name: 'العربية', proficiency: 'إتقان تام' }],
                    certificates: [{ title: 'TEFL', issuer: 'Cambridge' }],
                    links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/s' }],
                }),
            }),
        );
        assert.equal(card.jobTitleAr, 'مدرّسة فيزياء');
        assert.equal(card.experienceYears, 9);
        assert.deepEqual(card.specialties, [{ ar: 'فيزياء', en: null }, { ar: null, en: 'Astronomy' }]);
        assert.equal(card.experiences[0].organisation, 'مدرسة النخبة');
        assert.equal(card.qualifications[0].degree, 'ماجستير');
        assert.equal(card.languages[0].proficiency, 'إتقان تام');
        assert.equal(card.certificates[0].issuer, 'Cambridge');
        assert.equal(card.links[0].url, 'https://linkedin.com/in/s');
    });

    test('a profile written before the change still renders', () => {
        // Teachers filled the flat keys first; the namespaced section must not
        // hide what they already saved.
        const card = toPublicInstructor(
            meta({
                fullName: 'خالد',
                nameAr: 'خالد',
                jobTitleAr: 'مدرّس لغة إنجليزية',
                bio: 'نبذة قصيرة',
                bioEn: 'Short bio',
                specialty: 'لغة إنجليزية',
                experienceYears: 5,
            }),
        );
        assert.equal(card.nameAr, 'خالد');
        assert.equal(card.jobTitleAr, 'مدرّس لغة إنجليزية');
        assert.equal(card.bioAr, 'نبذة قصيرة');
        assert.equal(card.bioEn, 'Short bio');
        assert.equal(card.specialtyAr, 'لغة إنجليزية');
        assert.equal(card.experienceYears, 5);
        // The old single `specialty` is presented as a one-item list.
        assert.deepEqual(card.specialties, [{ ar: 'لغة إنجليزية', en: 'لغة إنجليزية' }]);
    });

    test('namespaced values win over the legacy keys', () => {
        const card = toPublicInstructor(
            meta({
                jobTitleAr: 'المسمى القديم',
                [PROFILE_KEY]: { jobTitle: { ar: 'المسمى الجديد' } },
            }),
        );
        assert.equal(card.jobTitleAr, 'المسمى الجديد');
    });

    test('a corrupt stored section degrades to empty instead of throwing', () => {
        // A public page must never 500 because of one bad row.
        const card = toPublicInstructor(
            meta({
                [PROFILE_KEY]: { experiences: [{ role: 'missing organisation' }], links: [{ url: 'https://x.test' }] },
            }),
        );
        assert.deepEqual(card.experiences, []);
        assert.deepEqual(card.links, []);
    });

    test('readInstructorProfile tolerates anything already in the column', () => {
        for (const junk of [null, undefined, 'text', 42, [], { experiences: 'no' }]) {
            assert.deepEqual(readInstructorProfile(junk), emptyInstructorProfile());
        }
    });
});
