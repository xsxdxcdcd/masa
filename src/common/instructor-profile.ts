import { BadRequestException } from '@nestjs/common';

/**
 * The instructor's public profile — the single source of truth for "what a
 * student is allowed to see about their teacher".
 *
 * There is no `Instructor` table: an instructor is a `User`, and their profile
 * lives in the free-form `metadata` JSON. That single bag was the problem this
 * module exists to solve. It holds two things that have nothing to do with each
 * other:
 *
 *   - account and personal data collected at registration (`phone`,
 *     `birthDate`, `gender`, `country`, `city`) — none of it belongs on a
 *     profile page a student browses;
 *   - the public CV a teacher fills in to describe themselves.
 *
 * Because the CV sat in the same bag, "edit my public profile" had no boundary:
 * the editor page, the sanitiser and the public projection each listed keys by
 * hand, so they had drifted apart, and there was no single place that could be
 * read to answer "is this field shown to students?". Everything about the public
 * profile is therefore declared here once — the whitelist, the shapes, the
 * bounds — and the write path, the public payload and the UI all derive from it.
 *
 * The account/personal keys are deliberately NOT listed, so they can never be
 * written through this module and are never projected out of it.
 */

/** Bilingual text. Both sides optional; each falls back to the other on read. */
export interface BilingualText {
    ar?: string | null;
    en?: string | null;
}

/** One entry of the professional-experience timeline. */
export interface ProfileExperience extends BilingualText {
    /** e.g. "مدرّس أول" / "Senior Instructor". Free text so it fits any school. */
    role: string;
    /** Organisation, school or company. */
    organisation: string;
    /** Free-text span, e.g. "2021" or "2021 – 2024". A single year is the norm. */
    from?: string | null;
    to?: string | null;
    /** What the role involved. */
    description?: string | null;
}

/** A degree, diploma or academic credential. */
export interface ProfileQualification extends BilingualText {
    degree: string;
    field?: string | null;
    institution?: string | null;
    year?: string | null;
}

/** A language the teacher teaches in or works in. */
export interface ProfileLanguage extends BilingualText {
    /** Language name, e.g. "العربية" / "Arabic". */
    name: string;
    /** Free text so it is not forced into a narrow enum: "إتقان تام". */
    proficiency?: string | null;
}

/** A professional or teaching certificate. */
export interface ProfileCertificate extends BilingualText {
    title: string;
    issuer?: string | null;
    year?: string | null;
}

/** A public professional link. https only, and never a bare scheme-less string. */
export interface ProfileLink {
    /** e.g. "LinkedIn", "الموقع الإلكتروني". */
    label: string;
    url: string;
}

/** The public profile as it is stored in `User.metadata`. */
export interface InstructorProfile {
    /** Bilingual name shown on the profile. Falls back to the account `fullName`. */
    name: BilingualText;
    /** Professional headline, e.g. "مدرّس رياضيات". */
    jobTitle: BilingualText;
    /** Short introduction. */
    bio: BilingualText;
    /** Subjects taught, as a list so a profile can show several. */
    specialties: BilingualText[];
    /** Total years of teaching experience, as a headline number. */
    experienceYears: number | null;
    /** The detailed experience timeline. */
    experiences: ProfileExperience[];
    /** Academic credentials. */
    qualifications: ProfileQualification[];
    /** Teaching / working languages. */
    languages: ProfileLanguage[];
    /** Professional certificates. */
    certificates: ProfileCertificate[];
    /** Professional links. */
    links: ProfileLink[];
}

/** Where the profile lives inside `User.metadata`, and how it is shaped there. */
export const PROFILE_KEY = 'publicProfile';

/**
 * Bounds for the structured sections.
 *
 * `metadata` is free-form JSON, so without a cap on both the number of entries
 * and the length of each string a teacher could store a megabyte-long profile
 * and have every visitor of their public page download it. Generous enough for
 * a real CV, small enough to stay cheap to render.
 */
const LIMITS = {
    specialties: { maxItems: 12, text: 80 },
    experiences: { maxItems: 15, text: 200, description: 600 },
    qualifications: { maxItems: 10, text: 160, year: 20 },
    languages: { maxItems: 10, text: 80 },
    certificates: { maxItems: 15, text: 160 },
    links: { maxItems: 6, text: 80, url: 300 },
    name: 120,
    jobTitle: 140,
    bio: 1200,
} as const;

/** Maximum length of a free-text year/period field. */
const YEAR_MAX = 24;

function bad(field: string): never {
    throw new BadRequestException(`instructor profile: ${field} is invalid`);
}

/** A trimmed string, or null when it is absent, not a string, or empty. */
function text(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, max);
    return trimmed.length > 0 ? trimmed : null;
}

/** The same, but for the required fields of a structured entry. */
function requiredText(value: unknown, max: number, field: string): string {
    const out = text(value, max);
    if (!out) bad(field);
    return out;
}

/** Reads `{ ar, en }` off an untrusted object. */
function bilingual(value: unknown, max: number, field: string): BilingualText {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    return {
        ar: text(source.ar, max),
        en: text(source.en, max),
    };
}

/**
 * Bilingual text as it should be displayed: the requested locale, falling back
 * to the other language rather than showing an empty line. A teacher who wrote
 * only Arabic still reads correctly on the English site.
 */
export function pickLanguage(value: BilingualText | null | undefined, locale: 'ar' | 'en'): string | null {
    if (!value) return null;
    const wanted = locale === 'en' ? value.en : value.ar;
    const other = locale === 'en' ? value.ar : value.en;
    return wanted || other || null;
}

/** Reduces a bilingual entry to the strings that actually have content. */
function compactText(value: BilingualText): BilingualText | null {
    return value.ar || value.en ? value : null;
}

/** Reads a list of `{ ar, en }`, dropping empties and capping the count. */
function bilingualList(value: unknown, limits: { maxItems: number; text: number }): BilingualText[] {
    if (!Array.isArray(value)) return [];
    const out: BilingualText[] = [];
    for (const item of value) {
        if (out.length >= limits.maxItems) break;
        const entry = bilingual(item, limits.text, 'specialties');
        const compact = compactText(entry);
        if (compact) out.push(compact);
    }
    return out;
}

function objectList<T>(value: unknown, maxItems: number): unknown[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, maxItems).filter((item) => item != null && typeof item === 'object' && !Array.isArray(item));
}

function readExperiences(value: unknown): ProfileExperience[] {
    return objectList(value, LIMITS.experiences.maxItems).map((raw) => {
        const source = raw as Record<string, unknown>;
        return {
            role: requiredText(source.role, LIMITS.experiences.text, 'experiences.role'),
            organisation: requiredText(source.organisation, LIMITS.experiences.text, 'experiences.organisation'),
            from: text(source.from, YEAR_MAX),
            to: text(source.to, YEAR_MAX),
            description: text(source.description, LIMITS.experiences.description),
        };
    });
}

function readQualifications(value: unknown): ProfileQualification[] {
    return objectList(value, LIMITS.qualifications.maxItems).map((raw) => {
        const source = raw as Record<string, unknown>;
        return {
            degree: requiredText(source.degree, LIMITS.qualifications.text, 'qualifications.degree'),
            field: text(source.field, LIMITS.qualifications.text),
            institution: text(source.institution, LIMITS.qualifications.text),
            year: text(source.year, LIMITS.qualifications.year),
        };
    });
}

function readLanguages(value: unknown): ProfileLanguage[] {
    return objectList(value, LIMITS.languages.maxItems).map((raw) => {
        const source = raw as Record<string, unknown>;
        return {
            name: requiredText(source.name, LIMITS.languages.text, 'languages.name'),
            proficiency: text(source.proficiency, LIMITS.languages.text),
        };
    });
}

function readCertificates(value: unknown): ProfileCertificate[] {
    return objectList(value, LIMITS.certificates.maxItems).map((raw) => {
        const source = raw as Record<string, unknown>;
        return {
            title: requiredText(source.title, LIMITS.certificates.text, 'certificates.title'),
            issuer: text(source.issuer, LIMITS.certificates.text),
            year: text(source.year, LIMITS.qualifications.year),
        };
    });
}

/**
 * A link is rendered as a real `href`, so it is held to the same rule as the
 * classroom link: https only, no embedded credentials, and a bounded length.
 * A teacher profile is staff-authored, but the field is stored free-form JSON
 * and the value ends up in an anchor on a page every visitor loads — an
 * off-site `javascript:` there would be stored XSS.
 */
function readLinks(value: unknown): ProfileLink[] {
    return objectList(value, LIMITS.links.maxItems).map((raw) => {
        const source = raw as Record<string, unknown>;
        const label = requiredText(source.label, LIMITS.links.text, 'links.label');
        const url = requiredText(source.url, LIMITS.links.url, 'links.url');

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            bad('links.url');
        }
        if (parsed.protocol !== 'https:') bad('links.url');
        if (parsed.username || parsed.password) bad('links.url');

        return { label, url: parsed.toString() };
    });
}

/**
 * The profile section, normalised and bounded, ready to store.
 *
 * Throws on a malformed entry rather than dropping it: a structured list has no
 * sensible partial state, and silently discarding a row would leave the teacher
 * wondering why the experience they just typed is missing. The error names the
 * field so the form can point at it.
 */
export function sanitizeInstructorProfile(value: unknown): InstructorProfile {
    if (value == null) {
        return emptyInstructorProfile();
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        bad('publicProfile');
    }
    const source = value as Record<string, unknown>;

    const yearsRaw = source.experienceYears;
    let experienceYears: number | null = null;
    if (yearsRaw !== undefined && yearsRaw !== null && yearsRaw !== '') {
        const parsed = typeof yearsRaw === 'number' ? yearsRaw : Number(String(yearsRaw).trim());
        if (!Number.isFinite(parsed) || parsed < 0) bad('experienceYears');
        // Clamped rather than rejected: a teacher claiming 200 years is a typo,
        // not an attack, and the number is only ever rendered as a headline.
        experienceYears = Math.min(Math.round(parsed), 80);
    }

    return {
        name: bilingual(source.name, LIMITS.name, 'name'),
        jobTitle: bilingual(source.jobTitle, LIMITS.jobTitle, 'jobTitle'),
        bio: bilingual(source.bio, LIMITS.bio, 'bio'),
        specialties: bilingualList(source.specialties, LIMITS.specialties),
        experienceYears,
        experiences: readExperiences(source.experiences),
        qualifications: readQualifications(source.qualifications),
        languages: readLanguages(source.languages),
        certificates: readCertificates(source.certificates),
        links: readLinks(source.links),
    };
}

export function emptyInstructorProfile(): InstructorProfile {
    return {
        name: {},
        jobTitle: {},
        bio: {},
        specialties: [],
        experienceYears: null,
        experiences: [],
        qualifications: [],
        languages: [],
        certificates: [],
        links: [],
    };
}

/** Reads the stored profile, tolerating anything a legacy row may contain. */
export function readInstructorProfile(raw: unknown): InstructorProfile {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return emptyInstructorProfile();
    try {
        return sanitizeInstructorProfile(raw);
    } catch {
        // A profile written by an older version of this module (or by hand) must
        // never take a public page down with it. The public read path degrades to
        // an empty profile instead of throwing.
        return emptyInstructorProfile();
    }
}
