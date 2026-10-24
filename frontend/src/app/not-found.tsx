"use client";

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import PublicMobileMenu from '@/components/PublicMobileMenu';
import ThemeToggle from '@/components/ThemeToggle';

export default function NotFound() {
    const { t } = useI18n();
    const { dark } = useTheme();

    return (
        <div className={`min-h-screen ${dark ? 'bg-brand-navy-dark' : 'bg-white'} flex flex-col`}>
            <header className={`px-8 py-6 flex items-center justify-between border-b ${dark ? 'border-white/5 bg-brand-navy-dark/80' : 'border-gray-200 bg-white/80'} backdrop-blur-md sticky top-0 z-40`}>
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${dark ? 'bg-brand-navy shadow-black/30' : 'bg-brand-mist'}`}>
                        <span className="text-brand-gold font-black text-xl">L</span>
                    </div>
                    <h1 className={`text-2xl font-black tracking-tight ${dark ? 'text-white' : 'text-brand-navy'}`}>
                        laxa<span className="text-brand-gold">lab</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <PublicMobileMenu />
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl -z-10"></div>

                <div className={`text-9xl font-black leading-none select-none ${dark ? 'text-white/90' : 'text-brand-navy'}`}>
                    4<span className="text-brand-gold">0</span>4
                </div>
                <h2 className={`text-3xl lg:text-4xl font-black mt-6 ${dark ? 'text-brand-gold-light' : 'text-brand-gold-dark'}`}>{t('notFound.title')}</h2>
                <p className={`mt-3 max-w-md leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('notFound.desc')}</p>
                <div className="flex flex-wrap justify-center gap-4 mt-10">
                    <Link href="/" className="bg-brand-gold text-brand-navy-dark px-7 py-3.5 rounded-xl font-bold hover:bg-brand-gold-light transition-all duration-300 shadow-md hover:shadow-lg">
                        {t('notFound.home')}
                    </Link>
                    <Link href="/courses" className={`border-2 ${dark ? 'border-white/10 text-white hover:border-brand-gold hover:text-brand-gold-light' : 'border-gray-300 text-brand-navy hover:border-brand-gold-dark hover:text-brand-gold-dark'} px-7 py-3.5 rounded-xl font-bold transition-all duration-300`}>
                        {t('notFound.explore')}
                    </Link>
                </div>
            </main>
        </div>
    );
}