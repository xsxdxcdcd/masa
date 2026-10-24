"use client";

import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';

export interface LegalSection {
    titleAr: string;
    titleEn: string;
    bodyAr?: string;
    bodyEn?: string;
    itemsAr?: string[];
    itemsEn?: string[];
}

export interface LegalPageProps {
    titleAr: string;
    titleEn: string;
    introAr?: string;
    introEn?: string;
    updatedAr?: string;
    updatedEn?: string;
    sections: LegalSection[];
}

export default function LegalPage({ titleAr, titleEn, introAr, introEn, updatedAr, updatedEn, sections }: LegalPageProps) {
    const { locale } = useI18n();
    const { dark } = useTheme();
    const isAr = locale === 'ar';

    const bgRoot = dark ? 'bg-brand-navy-dark' : 'bg-brand-white';
    const headerCls = dark
        ? 'border-b border-white/10 bg-brand-navy-dark/80 backdrop-blur-md'
        : 'border-b border-gray-200 bg-white/80 backdrop-blur-md';
    const navLinkCls = dark
        ? 'hover:text-brand-gold transition'
        : 'hover:text-brand-gold-dark transition';
    const navTextCls = dark ? 'text-gray-300' : 'text-gray-600';
    const titleCls = dark ? 'text-white' : 'text-brand-navy';
    const updatedCls = dark ? 'text-gray-400' : 'text-gray-500';
    const bodyCls = dark ? 'text-gray-300' : 'text-gray-600';
    const headingCls = dark ? 'text-white' : 'text-brand-navy';
    const footerCls = dark ? 'text-gray-400 border-t border-white/5' : 'text-gray-500 border-t border-gray-200';

    return (
        <div className={`min-h-screen ${bgRoot}`}>
            <header className={`px-4 md:px-8 py-4 md:py-6 flex items-center justify-between gap-4 flex-wrap ${headerCls}`}>
                <Link href="/" className={`text-xl md:text-2xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>
                    laxa<span className="text-brand-gold">lab</span>
                </Link>
                <nav className={`flex items-center gap-4 md:gap-6 text-xs md:text-sm font-bold ${navTextCls}`}>
                    <Link href="/courses" className={navLinkCls}>{isAr ? 'الدورات' : 'Courses'}</Link>
                    <Link href="/blog" className={navLinkCls}>{isAr ? 'المدونة' : 'Blog'}</Link>
                    <Link href="/login" className={navLinkCls}>{isAr ? 'تسجيل الدخول' : 'Sign in'}</Link>
                    <ThemeToggle />
                </nav>
            </header>

            <main className="max-w-3xl mx-auto px-4 md:px-6 py-12">
                <h1 className={`text-3xl font-black mb-2 ${titleCls}`}>{isAr ? titleAr : titleEn}</h1>
                {((isAr ? updatedAr : updatedEn) || '') && (
                    <p className={`text-sm mb-6 font-semibold ${updatedCls}`}>{isAr ? updatedAr : updatedEn}</p>
                )}
                {((isAr ? introAr : introEn) || '') && (
                    <p className={`leading-relaxed mb-8 ${bodyCls}`}>{isAr ? introAr : introEn}</p>
                )}

                <div className="space-y-10">
                    {sections.map((section, i) => (
                        <section key={i}>
                            <h2 className={`text-xl font-bold mb-3 ${headingCls}`}>{isAr ? section.titleAr : section.titleEn}</h2>
                            {((isAr ? section.bodyAr : section.bodyEn) || '') && (
                                <p className={`leading-relaxed mb-2 ${bodyCls}`}>{isAr ? section.bodyAr : section.bodyEn}</p>
                            )}
                            {((isAr ? section.itemsAr : section.itemsEn) || []).length > 0 && (
                                <ul className={`list-disc pl-6 space-y-1 leading-relaxed ${bodyCls}`}>
                                    {(isAr ? section.itemsAr : section.itemsEn)?.map((item, j) => (
                                        <li key={j}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>

                <div className={`mt-12 pt-8 border-t flex flex-wrap gap-6 text-sm font-bold ${dark ? 'border-white/10 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                    <Link href="/terms" className={navLinkCls}>{isAr ? 'الشروط والأحكام' : 'Terms of Service'}</Link>
                    <Link href="/privacy" className={navLinkCls}>{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>
                    <Link href="/refund-policy" className={navLinkCls}>{isAr ? 'سياسة الاسترداد' : 'Refund Policy'}</Link>
                    <Link href="/cookies" className={navLinkCls}>{isAr ? 'سياسة ملفات الارتباط' : 'Cookie Policy'}</Link>
                </div>
            </main>

            <footer className={`py-8 text-center text-sm font-semibold ${footerCls}`}>
                &copy; {new Date().getFullYear()} Laxalab. All rights reserved.
            </footer>
        </div>
    );
}