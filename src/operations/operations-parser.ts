/**
 * Turns a User-Agent into the three fields the operations center groups by:
 * device type, OS and browser.
 *
 * WHY A HAND-ROLLED PARSER AND NOT A LIBRARY
 * This is display-only classification for an admin table. It deliberately
 * recognizes the common families and returns "unknown" rather than guessing
 * wrong -- the raw UA string is stored alongside it, so a misclassification is
 * always recoverable by reading the original.
 *
 * The order matters: Edge and Opera both claim to be Chrome, and Chrome claims
 * to be Safari, so the more specific token has to be tested first or every
 * Chromium browser reports as Safari.
 */
export interface ParsedUserAgent {
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'tv' | 'unknown';
    os: string;
    browser: string;
    isBot: boolean;
}

const UNKNOWN: Omit<ParsedUserAgent, 'isBot'> = {
    deviceType: 'unknown',
    os: 'Unknown',
    browser: 'Unknown',
};

export function parseUserAgent(ua: string | undefined | null): ParsedUserAgent {
    if (!ua || ua.trim().length === 0) {
        return { ...UNKNOWN, isBot: false };
    }
    const s = ua.toLowerCase();

    // Crawlers first: a bot's UA often also contains "Safari" and "Intel",
    // so classifying it as a desktop browser would bury it in the noise.
    if (
        /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|applebot|headlesschrome|lighthouse|uptimerobot|axios\/|postmanruntime|curl\/|wget\/|python-requests|httpclient|node-fetch|go-http-client|apache-httpclient/.test(s)
    ) {
        return { deviceType: 'bot', os: 'Unknown', browser: 'Unknown', isBot: true };
    }

    // TVs and consoles report as desktop Linux/Windows; grouping them apart
    // keeps "a viewer is watching on a TV" visible in the device breakdown.
    if (/smart-?tv|smarttv|appletv|appletv|googletv|hbbtv|netcast|viera|web0s|tizen.*tv|aft[0-9]|bravia|chromecast/.test(s)) {
        return { deviceType: 'tv', os: detectOs(s), browser: detectBrowser(s), isBot: false };
    }

    const deviceType: ParsedUserAgent['deviceType'] = /ipad|tablet|playbook|silk|(android(?!.*mobile))[\s\S]*;|kindle|nexus (7|9|10)/.test(s)
        ? 'tablet'
        : /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini|iemobile/.test(s)
            ? 'mobile'
            : 'desktop';

    return { deviceType, os: detectOs(s), browser: detectBrowser(s), isBot: false };
}

function detectOs(s: string): string {
    if (s.includes('windows nt')) return 'Windows';
    if (/iphone|ipad|ipod/.test(s)) return 'iOS';
    if (s.includes('android')) return 'Android';
    if (s.includes('mac os x') || s.includes('macintosh')) return 'macOS';
    if (s.includes('cros')) return 'ChromeOS';
    if (s.includes('ubuntu')) return 'Ubuntu';
    if (s.includes('linux')) return 'Linux';
    if (s.includes('freebsd')) return 'FreeBSD';
    return 'Unknown';
}

function detectBrowser(s: string): string {
    // Most specific first: Edge/Opera/Chrome all carry "chrome", Chrome carries
    // "safari". Reversing this order collapses the whole Chromium family into
    // "Chrome" and loses the distinction the admin actually wants.
    if (s.includes('edg/') || s.includes('edge/') || s.includes('edga/') || s.includes('edgios/')) return 'Edge';
    if (s.includes('opr/') || s.includes('opera')) return 'Opera';
    if (s.includes('vivaldi')) return 'Vivaldi';
    if (s.includes('brave')) return 'Brave';
    if (s.includes('yabrowser')) return 'Yandex';
    if (s.includes('samsungbrowser')) return 'Samsung Internet';
    if (s.includes('ucbrowser') || s.includes('ucbrowser')) return 'UC Browser';
    if (s.includes('firefox/')) return 'Firefox';
    if (s.includes('crios')) return 'Chrome';
    if (s.includes('fxios')) return 'Firefox';
    if (s.includes('chrome/') || s.includes('chromium/')) return 'Chrome';
    if (s.includes('safari/')) return 'Safari';
    if (s.includes('msie') || s.includes('trident')) return 'Internet Explorer';
    return 'Unknown';
}

/**
 * Metadata worth keeping on an event, and only that.
 *
 * The allow-list is the whole point. An event's `meta` is a Json column, which
 * makes it the easiest place in the codebase to start persisting whatever a
 * caller happens to pass -- and the most damaging place to do it, because login
 * and payment bodies flow through the same request pipeline. Anything not named
 * here is dropped rather than sanitized later.
 */
/**
 * `pickSafeMeta` is an allow-list, not a deny-list: anything not named here is
 * dropped before it reaches the database. That is deliberate -- the tracking
 * endpoints are unauthenticated, so an arbitrary client must not be able to
 * write arbitrary columns into someone else's event row.
 *
 * `actorId`/`targetUserId`/`keyVersion` are here for the operations settings
 * audit trail, which is exactly the kind of "who changed whose access" record
 * that is worthless without them. User ids are not secrets, and these are only
 * written by admin-authenticated endpoints.
 */
const SAFE_META_KEYS = new Set([
    'resourceId', 'resourceType', 'count', 'moduleId', 'courseId', 'reason',
    'actorId', 'targetUserId', 'keyVersion',
]);

export function pickSafeMeta(meta: unknown): Record<string, string | number> | undefined {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
        if (!SAFE_META_KEYS.has(k)) continue;
        if (typeof v === 'string') {
            out[k] = v.slice(0, 120);
        } else if (typeof v === 'number' && Number.isFinite(v)) {
            out[k] = v;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Truncates a UA so one pathological client cannot bloat the table. 512 chars
 * is far longer than any real UA; the browser/OS/browser fields are derived
 * before this, so truncating the raw string costs no classification.
 */
export function clampText(value: string | undefined | null, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
