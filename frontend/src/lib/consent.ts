export interface ConsentPrefs {
    necessary: true;
    analytics: boolean;
    marketing: boolean;
}

export const CONSENT_KEY = 'laxalab_consent';

export function readConsent(): ConsentPrefs | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ConsentPrefs>;
        if (typeof parsed?.analytics !== 'boolean' || typeof parsed?.marketing !== 'boolean') return null;
        return { necessary: true, analytics: parsed.analytics, marketing: parsed.marketing };
    } catch {
        return null;
    }
}

export function hasAnsweredConsent(): boolean {
    return readConsent() !== null;
}

export function saveConsent(prefs: ConsentPrefs): void {
    if (typeof window === 'undefined') return;
    const payload: ConsentPrefs = { necessary: true, analytics: !!prefs.analytics, marketing: !!prefs.marketing };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
    try {
        document.cookie = `laxalab_consent=${payload.analytics ? '1' : '0'}${payload.marketing ? '1' : '0'}; path=/; max-age=31536000; samesite=lax; ${
            process.env.NODE_ENV === 'production' ? 'secure; ' : ''
        }`;
    } catch {
        // non-critical
    }
}

export function clearConsent(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CONSENT_KEY);
    document.cookie = 'laxalab_consent=; path=/; max-age=0; samesite=lax';
}