export type Locale = 'ar' | 'en';

const DEFAULT_CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY || 'USD').toUpperCase();

function localeTag(locale?: Locale): string {
    return locale === 'ar' ? 'ar-EG' : 'en-US';
}

/** Localized currency formatting (e.g. "US$1,200" / "١٬٢٠٠ US$"). */
export function formatPrice(
    amount: number | string | null | undefined,
    opts?: { currency?: string; locale?: Locale }
): string {
    const value = Number(amount ?? 0);
    if (Number.isNaN(value)) return '—';
    const currency = (opts?.currency || DEFAULT_CURRENCY).toUpperCase();
    try {
        return new Intl.NumberFormat(localeTag(opts?.locale), {
            style: 'currency',
            currency,
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currency} ${value}`;
    }
}

/** Localized date formatting. */
export function formatDate(
    date?: string | Date | null,
    opts?: { locale?: Locale }
): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return '';
    try {
        return new Intl.DateTimeFormat(localeTag(opts?.locale), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(d);
    } catch {
        return d.toLocaleDateString();
    }
}

/** Localized large-number formatting (enrollments, counts, etc.). */
export function formatNumber(n: number | string | null | undefined, locale?: Locale): string {
    const value = Number(n ?? 0);
    if (Number.isNaN(value)) return '0';
    try {
        return new Intl.NumberFormat(localeTag(locale)).format(value);
    } catch {
        return String(value);
    }
}