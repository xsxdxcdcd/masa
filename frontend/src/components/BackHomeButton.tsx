"use client";

import Link from 'next/link';
import { Home } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';

// The way back to the homepage, for every page a signed-out visitor can land on.
//
// Several of those pages -- forgot-password, reset-password, the two auth gate
// pages, verify-email, the public certificate view, the blog -- are reached by
// following a link in an email or a shared URL, with no navigation around them
// and no site header to click. Someone who followed the wrong link had no way
// out except the browser back button or retyping the URL. This is that way out.
//
// It is a client component on purpose: several of the pages it is dropped into
// are server components (verify-certificate, certificate/[id], blog/[slug]), and
// those still need to read the locale and the theme from context.
//
// `position: fixed` rather than `absolute`, because the host pages are centered
// with flex and overflow-hidden in places, where an absolutely positioned child
// would be clipped or measured against the wrong ancestor.
export default function BackHomeButton({ className = '' }: { className?: string }) {
    const { t } = useI18n();
    const { dark } = useTheme();

    return (
        <Link
            href="/"
            aria-label={t('landing.home')}
            className={`fixed top-4 left-4 rtl:right-4 rtl:left-auto z-50 inline-flex items-center gap-2 rounded-full shadow-sm border px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold transition-colors ${dark ? 'bg-white/5 backdrop-blur-md border-white/10 text-gray-300 hover:text-brand-gold-light hover:border-white/20' : 'bg-white/90 backdrop-blur-md border-gray-200 text-brand-navy hover:text-brand-gold-dark hover:border-gray-300'} ${className}`}
        >
            <Home size={15} className="shrink-0" />
            <span className="hidden sm:inline">{t('landing.home')}</span>
        </Link>
    );
}
