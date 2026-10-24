"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "laxalab_theme";

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
  setDark: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => {}, setDark: () => {} });

function applyDark(value: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", value);
  document.documentElement.style.colorScheme = value ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    const isDark = saved === "dark";
    setDarkState(isDark);
    applyDark(isDark);
  }, []);

  const setDark = useCallback((value: boolean) => {
    setDarkState(value);
    applyDark(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = useCallback(() => setDark(!dark), [dark, setDark]);

  return <ThemeContext.Provider value={{ dark, toggle, setDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}