"use client";

import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n-context";
import { useTheme } from "@/lib/theme-context";
import { useCallback } from "react";

function withoutLocalePrefix(pathname: string): string {
    const first = pathname.split("/")[1];
    if (first === "ar" || first === "en") {
        return pathname.slice(first.length + 1) || "/";
    }
    return pathname === "" ? "/" : pathname;
}

export default function LanguageSwitcher({ dark }: { dark?: boolean }) {
    const { locale, isRtl, setLocale } = useI18n();
    const { dark: ctxDark } = useTheme();
    const isDark = dark ?? ctxDark;
    const pathname = usePathname();
    const router = useRouter();
    const base = withoutLocalePrefix(pathname);
    const next = locale === "ar" ? "en" : "ar";
    const href = base === "/" ? `/${next}` : `/${next}${base}`;

    const switchLang = useCallback(() => {
        setLocale(next);
        router.push(href);
    }, [next, href, setLocale, router]);

    return (
        <button
            type="button"
            onClick={switchLang}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition cursor-pointer ${
                isDark
                    ? "border-white/15 bg-white/5 text-brand-mist/90 hover:bg-white/10 hover:text-white"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
            dir={isRtl ? "rtl" : "ltr"}
        >
            <span className="mb-0.5">🌐</span>
            <span>{locale === "ar" ? "English" : "العربية"}</span>
        </button>
    );
}