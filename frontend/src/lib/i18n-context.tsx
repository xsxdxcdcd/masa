"use client";

import React, { createContext, useContext, useEffect, useCallback, useMemo, ReactNode, useState } from "react";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

type Locale = "ar" | "en";

type TranslationDict = {
    [key: string]: string | TranslationDict;
};

interface I18nContextProps {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
    isRtl: boolean;
    pick: (obj: unknown, field: string) => string | undefined;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

const translations: Record<Locale, TranslationDict> = { ar, en };

// Must match the middleware cookie name. See the note there: the unversioned
// key is ignored on purpose so stale `en` values written by the old
// Accept-Language sniffing cannot pin visitors to English.
const LOCALE_COOKIE = "laxalab_locale_v2";
const LOCALE_KEY = "laxalab_locale_v2";

function pickValue(obj: unknown, field: string, locale: Locale): string | undefined {
    if (!obj || typeof obj !== "object") return undefined;
    const record = obj as Record<string, unknown>;
    const arVal = record[field + "Ar"];
    const enVal = record[field + "En"];
    const ar = typeof arVal === "string" ? arVal : undefined;
    const en = typeof enVal === "string" ? enVal : undefined;
    return locale === "ar" ? (ar ?? en) : (en ?? ar);
}

export function I18nProvider({ children, locale: initialLocale = "ar" }: { children: ReactNode; locale?: Locale }) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale);

    // Keep <html> (and fonts) in sync with the active locale (client navigation).
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
        document.documentElement.style.setProperty(
            "font-family",
            locale === "ar" ? "var(--font-tajawal), sans-serif" : "var(--font-manrope), sans-serif"
        );
    }, [locale]);

    const setLocale = useCallback((newLocale: Locale) => {
        localStorage.setItem(LOCALE_KEY, newLocale);
        document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=31536000; samesite=lax; ${
            process.env.NODE_ENV === "production" ? "secure; " : ""
        }`;
        setLocaleState(newLocale);
    }, []);

    // Cross-tab sync: re-read when another tab changes the locale.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === LOCALE_KEY && e.newValue) {
                setLocaleState(e.newValue as Locale);
            }
        };
        const onVisibility = () => {
            const saved = localStorage.getItem(LOCALE_KEY);
            if (saved === "ar" || saved === "en") {
                setLocaleState(saved);
            }
        };
        window.addEventListener("storage", onStorage);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("storage", onStorage);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    const t = useCallback(
        (key: string): string => {
            const keys = key.split(".");
            let value: string | TranslationDict | undefined = translations[locale];
            let fallback: string | TranslationDict | undefined = translations["en"];

            for (const k of keys) {
                value = value && typeof value === "object" ? (value as TranslationDict)[k] : undefined;
                fallback = fallback && typeof fallback === "object" ? (fallback as TranslationDict)[k] : undefined;
            }

            return typeof value === "string"
                ? value || (typeof fallback === "string" ? fallback : key)
                : typeof fallback === "string"
                  ? fallback || key
                  : key;
        },
        [locale]
    );

    const pick = useCallback((obj: unknown, field: string) => pickValue(obj, field, locale), [locale]);

    const contextValue = useMemo(() => ({ locale, setLocale, t, isRtl: locale === "ar", pick }), [locale, setLocale, t, pick]);

    return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error("useI18n must be used within an I18nProvider");
    }
    return context;
}