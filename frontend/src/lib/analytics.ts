import { readConsent, type ConsentPrefs } from './consent';

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function isAnalyticsApproved(): boolean {
    return readConsent()?.analytics ?? false;
}

export function isMarketingApproved(): boolean {
    return readConsent()?.marketing ?? false;
}

function ensureGtag() {
    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
        window.gtag = (...args: unknown[]) => {
            window.dataLayer!.push(args);
        };
    }
    return window.gtag!;
}

function loadGA4() {
    if (!GA4_ID || document.getElementById('laxalab-ga4')) return;
    ensureGtag();
    const script = document.createElement('script');
    script.id = 'laxalab-ga4';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(script);
    ensureGtag()('js', new Date());
    ensureGtag()('config', GA4_ID, { anonymize_ip: true, allow_google_signals: false });
}

function loadGTM() {
    if (!GTM_ID || document.getElementById('laxalab-gtm')) return;
    const script = document.createElement('script');
    script.id = 'laxalab-gtm';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(script);
}

/**
 * Called after the user saves their preferences. Loads the relevant tags
 * only for the categories the user approved.
 */
export function applyConsent(prefs: ConsentPrefs): void {
    if (typeof window === 'undefined') return;
    if (prefs.analytics) loadGA4();
    if (prefs.marketing) loadGTM();
}

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (typeof window === 'undefined' || !isAnalyticsApproved()) return;
    ensureGtag()('event', eventName, params);
}