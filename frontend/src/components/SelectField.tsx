"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectFieldProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder: string;
    icon?: LucideIcon;
    inputCls: string;
    id?: string;
    ariaLabel?: string;
}

interface MenuPos {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    dropUp: boolean;
}

export default function SelectField({
    value,
    onChange,
    options,
    placeholder,
    icon: Icon,
    inputCls,
    id,
    ariaLabel,
}: SelectFieldProps) {
    const { dark } = useTheme();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [pos, setPos] = useState<MenuPos | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value);
    const display = selected ? selected.label : placeholder;

    const measure = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom;
        const above = rect.top;
        const wanted = options.length * 44 + 16;
        const dropUp = below < Math.min(wanted, 200) && above > below;
        const maxHeight = Math.max(120, (dropUp ? above : below) - 16);
        setPos({
            top: dropUp ? rect.top - 8 : rect.bottom + 8,
            left: rect.left,
            width: rect.width,
            maxHeight,
            dropUp,
        });
    }, [options.length]);

    useLayoutEffect(() => {
        if (open) measure();
    }, [open, measure]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        const reposition = () => measure();
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        return () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [open, measure]);

    useEffect(() => {
        if (!open) return;
        if (activeIndex < 0) return;
        menuRef.current
            ?.querySelectorAll('[role="option"]')
            [activeIndex]?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    const commit = (next: string) => {
        onChange(next);
        setOpen(false);
        triggerRef.current?.focus();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && options[activeIndex]) commit(options[activeIndex].value);
        }
    };

    const trigger = (
        <button
            ref={triggerRef}
            id={id}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={ariaLabel}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={onKeyDown}
            className={`${inputCls} cursor-pointer flex items-center gap-2 text-start ${open ? "ring-2 ring-brand-gold border-brand-gold" : ""}`}
        >
            {Icon && (
                <span
                    className={`absolute start-4 flex items-center pointer-events-none transition-colors ${open || value ? (dark ? "text-brand-gold" : "text-brand-gold-dark") : "text-gray-400"}`}
                >
                    <Icon size={18} />
                </span>
            )}
            <span className={`flex-1 truncate ${value ? "" : "opacity-60"}`}>{display}</span>
            <ChevronDown
                size={16}
                className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
        </button>
    );

    const menu: ReactNode =
        pos ? (
            <div
                ref={menuRef}
                role="listbox"
                className={`fixed z-[100] p-1.5 overflow-y-auto admin-scroll rounded-xl border shadow-2xl shadow-black/40 animate-fade-in ${
                    dark ? "bg-brand-navy border-white/10" : "bg-white border-gray-200"
                }`}
                style={{
                    top: pos.top,
                    left: pos.left,
                    width: pos.width,
                    maxHeight: pos.maxHeight,
                    transform: pos.dropUp ? "translateY(-100%)" : undefined,
                }}
            >
                <div className="py-0.5" />
                {options.map((opt, i) => {
                    const isSelected = opt.value === value;
                    const isActive = i === activeIndex;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={() => commit(opt.value)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-start ${
                                isActive
                                    ? dark
                                        ? "bg-white/10 text-white"
                                        : "bg-brand-mist text-brand-navy"
                                    : dark
                                      ? "text-gray-300 hover:text-white"
                                      : "text-brand-navy/80 hover:text-brand-navy"
                            }`}
                        >
                            <span className="flex-1 truncate">{opt.label}</span>
                            {isSelected && (
                                <Check
                                    size={16}
                                    className={`shrink-0 ${dark ? "text-brand-gold" : "text-brand-gold-dark"}`}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        ) : null;

    return (
        <>
            <div className="relative">{trigger}</div>
            {open &&
                createPortal(
                    <>
                        <div
                            className="fixed inset-0 z-[99]"
                            onClick={() => {
                                setOpen(false);
                                triggerRef.current?.focus();
                            }}
                        />
                        {menu}
                    </>,
                    document.body,
                )}
        </>
    );
}
