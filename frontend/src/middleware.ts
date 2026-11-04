import { NextRequest, NextResponse } from 'next/server';

type Locale = 'ar' | 'en';

// Versioned on purpose. The previous name (`laxalab_locale`) is still sitting
// in every returning visitor's browser, written by the old Accept-Language
// sniffing, and it carries a `max-age` of a year. Honouring it would keep
// sending the entire existing audience to /en even though Arabic is now the
// primary language, so the old key is deliberately ignored and the new default
// applies once. From here on an explicit choice is what selects the language.
const LOCALE_COOKIE = 'laxalab_locale_v2';
const INTERNAL_LOCALE_REWRITE_HEADER = 'x-laxalab-internal-locale-rewrite';
const DEFAULT_LOCALE: Locale = 'ar';
const SKIP_PATHS = ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/favicon.ico'];
const EXT_RE = /\.(png|jpe?g|svg|gif|webp|ico|avif|woff2?|ttf|eot|otf|pdf|mp4|webm)$/i;

function getPreferredLocale(req: NextRequest): Locale {
    // Arabic is the primary language, so the only thing that may select
    // English is the visitor having explicitly chosen it. This used to fall
    // back to the browser's Accept-Language header, which sent every visitor
    // whose OS or Chrome UI is English to /en and made the platform read as
    // English-first despite `x-default`, the sitemap and the metadata all
    // pointing at Arabic.
    const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
    if (cookie === 'ar' || cookie === 'en') return cookie;
    return DEFAULT_LOCALE;
}

function setLocaleCookie(res: NextResponse, locale: Locale) {
    res.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
    });
}

// The learner, instructor, and administration pages share one origin.
// Authorization remains enforced by the page guards and the API permission
// guards after the user signs in.
export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Never touch API routes, Next internals or static files.
    if (pathname.startsWith('/api') || pathname.startsWith('/_next') || SKIP_PATHS.includes(pathname) || EXT_RE.test(pathname)) {
        return NextResponse.next();
    }

    const first = pathname.split('/')[1];
    const hasPrefix = first === 'ar' || first === 'en';
    const base = hasPrefix ? pathname.slice(first.length + 1) || '/' : pathname;

    // The internal rewrite from /ar/... to the actual route re-enters
    // middleware. Mark that request so it does not redirect back to /ar/...
    if (req.headers.get(INTERNAL_LOCALE_REWRITE_HEADER) === '1') {
        return NextResponse.next();
    }

    if (hasPrefix) {
        const locale = first as Locale;
        const url = req.nextUrl.clone();
        url.pathname = base;
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set(INTERNAL_LOCALE_REWRITE_HEADER, '1');
        const forwardedCookies = requestHeaders.get('cookie')?.split(';')
            .map((cookie) => cookie.trim())
            .filter((cookie) => cookie && !cookie.startsWith(`${LOCALE_COOKIE}=`)) ?? [];
        forwardedCookies.push(`${LOCALE_COOKIE}=${locale}`);
        requestHeaders.set('cookie', forwardedCookies.join('; '));
        const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
        setLocaleCookie(res, locale);
        return res;
    }

    // No locale prefix: redirect to the locale-prefixed canonical URL.
    //
    // 307 (temporary), not 308 (permanent). The destination is a function of
    // this request — the cookie, i.e. what the visitor chose — so "permanent"
    // was never the right status. Worse, browsers cache a 308 indefinitely and
    // never re-ask: one visit while the old Accept-Language sniffing was active
    // left `https://site/` -> `https://site/en` sitting in the visitor's disk
    // cache, so the site kept serving English even after the server was fixed
    // and started answering /ar. A 307 plus no-store means the redirect is
    // re-evaluated on every visit, which is what a preference-dependent
    // redirect has to do.
    const locale = getPreferredLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    const res = NextResponse.redirect(url, 307);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    setLocaleCookie(res, locale);
    return res;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};