/** Bilingual text, e.g. a specialty or a job title. One side may be empty. */
export interface BilingualText {
    ar?: string | null;
    en?: string | null;
}

/** One entry of the instructor's professional-experience timeline. */
export interface ProfileExperience {
    role: string;
    organisation: string;
    from?: string | null;
    to?: string | null;
    description?: string | null;
}

export interface ProfileQualification {
    degree: string;
    field?: string | null;
    institution?: string | null;
    year?: string | null;
}

export interface ProfileLanguage {
    name: string;
    proficiency?: string | null;
}

export interface ProfileCertificate {
    title: string;
    issuer?: string | null;
    year?: string | null;
}

/** A professional link. The backend only ever returns https URLs. */
export interface ProfileLink {
    label: string;
    url: string;
}

/**
 * The public shape of an instructor, as returned by the public endpoints
 * (`/public/instructors`, `/public/instructors/:id`, and the instructor nested
 * in a public course).
 *
 * The email is deliberately absent: public course payloads used to embed it and
 * the UI rendered it as the instructor's display name, which both leaked a
 * private field and broke once the backend stopped sending it. Identity now
 * comes from the bilingual name, read through `pick(entity, 'name')`.
 *
 * `nameAr`/`nameEn` and the other pairs are read with the shared `pick()`
 * helper from `@/lib/i18n-context`.
 *
 * The structured lists are what a student actually judges a teacher by, so they
 * travel with the card. They are already bounded and sanitised server-side.
 */
export interface PublicInstructorCard {
    id: string;
    nameAr: string | null;
    nameEn: string | null;
    avatarUrl: string | null;
    jobTitleAr: string | null;
    jobTitleEn: string | null;
    bioAr: string | null;
    bioEn: string | null;
    specialtyAr: string | null;
    specialtyEn: string | null;
    experienceYears: number | null;
    isProfileIncomplete: boolean;
    /** Subjects taught. May be empty even when `specialtyAr/En` is set. */
    specialties?: BilingualText[];
    experiences?: ProfileExperience[];
    qualifications?: ProfileQualification[];
    languages?: ProfileLanguage[];
    certificates?: ProfileCertificate[];
    links?: ProfileLink[];
}
