import { BadRequestException } from '@nestjs/common';

/**
 * Hosts allowed to host a batch classroom link.
 *
 * The link is typed by staff and then surfaced as a prominent "join the lesson"
 * button to every approved student, which makes it the highest-trust URL in the
 * product: a compromised course-manager account could otherwise park a
 * phishing or malware page where a paid learner expects their classroom. So the
 * value is an https URL on a known meeting host and nothing else — no
 * `javascript:`, no data:, no lookalike host.
 */
const MEETING_HOST_SUFFIXES = [
    'meet.google.com',
    'zoom.us',
    'teams.microsoft.com',
];

export function normalizeMeetLink(raw: unknown): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;

    if (typeof raw !== 'string') {
        throw new BadRequestException('meetLink must be a string');
    }
    const value = raw.trim();
    if (value.length > 500) {
        throw new BadRequestException('meetLink is too long');
    }

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new BadRequestException('meetLink must be a valid URL');
    }
    if (url.protocol !== 'https:') {
        throw new BadRequestException('meetLink must use https');
    }
    // Credentials in the URL are a phishing trick ("meet.google.com@evil.test"
    // parses as host evil.test) and are never legitimate here.
    if (url.username || url.password) {
        throw new BadRequestException('meetLink must not embed credentials');
    }

    // Compare on the label boundary so "evismeet.google.com" cannot pass as
    // meet.google.com, while "meet.google.com" itself and any subdomain match.
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const allowed = MEETING_HOST_SUFFIXES.some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
    if (!allowed) {
        throw new BadRequestException(
            `meetLink must be a Google Meet, Zoom or Teams link (${MEETING_HOST_SUFFIXES.join(', ')})`,
        );
    }
    // Re-serialise so what we store is the normalised form, not what was typed.
    return url.toString();
}
