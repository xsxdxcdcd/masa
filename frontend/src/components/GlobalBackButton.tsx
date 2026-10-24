"use client";

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

const HIDE_ON = ['/', '/ar', '/en'];

export default function GlobalBackButton() {
    const pathname = usePathname();
    const router = useRouter();
    const { locale } = useI18n();

    const clean = pathname.replace(/^\/(ar|en)/, '') || '/';
    if (HIDE_ON.includes(clean)) return null;

    return (
        <button
            onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push(`/${locale}`);
            }}
            className="fixed bottom-6 start-6 z-50 w-12 h-12 rounded-full bg-brand-navy-dark border border-white/10 text-white shadow-xl shadow-black/30 flex items-center justify-center hover:bg-brand-gold hover:text-black hover:border-brand-gold hover:shadow-brand-gold/20 transition-all duration-300 group cursor-pointer"
            title="Back"
        >
            <ArrowLeft size={20} className="rtl:-scale-x-100 group-hover:-translate-x-0.5 transition-transform" />
        </button>
    );
}
