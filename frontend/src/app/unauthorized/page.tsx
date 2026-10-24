"use client";

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import BackHomeButton from '@/components/BackHomeButton';

export default function UnauthorizedPage() {
    const { t } = useI18n();
    const { dark } = useTheme();

    return (
        <div className={`flex min-h-screen w-full flex-col items-center justify-center px-4 py-10 ${dark ? 'bg-brand-navy-dark' : 'bg-gray-50'}`}>
            <BackHomeButton />
            <ShieldAlert size={80} className="text-brand-gold mb-6" />
            <h1 className={`text-4xl font-bold ${dark ? 'text-white' : 'text-brand-navy'}`}>{t('unauthorized.title')}</h1>
            <p className={`mt-3 max-w-md text-center ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('unauthorized.desc')}
            </p>
            <Link href="/dashboard">
                <button className="mt-8 px-6 py-3 bg-brand-gold text-brand-navy-dark rounded-lg font-bold shadow-md hover:bg-brand-gold-light transition">
                    {t('unauthorized.return_dashboard')}
                </button>
            </Link>
        </div>
    );
}