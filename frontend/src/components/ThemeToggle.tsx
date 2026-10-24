"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { dark, toggle } = useTheme();
  const { locale } = useI18n();
  const isAr = locale === "ar";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? (isAr ? "الوضع النهاري" : "Light mode") : isAr ? "الوضع الليلي" : "Dark mode"}
      title={dark ? (isAr ? "الوضع النهاري" : "Light mode") : isAr ? "الوضع الليلي" : "Dark mode"}
      className={`flex items-center justify-center w-9 h-9 rounded-lg border transition cursor-pointer ${
        dark
          ? "border-white/15 bg-white/5 text-brand-gold-light hover:bg-white/10 hover:text-brand-gold-light"
          : "border-gray-200 bg-white text-brand-navy hover:bg-brand-mist"
      } ${className}`}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}