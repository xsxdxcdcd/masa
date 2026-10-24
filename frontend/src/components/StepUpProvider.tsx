"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { setStepUpHandler } from '@/lib/stepup-bridge';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';

// Mounted once in the root layout. When any axios call is answered with
// 403 + { stepUpRequired: true }, the api interceptor comes here for a fresh
// authenticator code and retries the request with X-Step-Up-Code.
export default function StepUpProvider() {
    const { t } = useI18n();
    const { dark } = useTheme();
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState('');
    const [invalid, setInvalid] = useState(false);
    const resolverRef = useRef<((code: string | null) => void) | null>(null);

    useEffect(() => {
        setStepUpHandler((resolve) => {
            resolverRef.current = resolve;
            setCode('');
            setInvalid(false);
            setOpen(true);
        });
        return () => setStepUpHandler(null);
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        const resolver = resolverRef.current;
        resolverRef.current = null;
        resolver?.(null);
    }, []);

    const confirm = useCallback(() => {
        const digits = code.replace(/\D/g, '');
        if (digits.length !== 6) {
            setInvalid(true);
            return;
        }
        setOpen(false);
        const resolver = resolverRef.current;
        resolverRef.current = null;
        resolver?.(digits);
    }, [code]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
            <div className={`relative w-full max-w-md rounded-2xl p-6 sm:p-8 ${dark ? 'bg-brand-navy-dark border border-white/10' : 'bg-white border border-gray-200 shadow-2xl'}`}>
                <h2 className={`text-xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>{t('twoFactorSetup.needCodeTitle')}</h2>
                <p className={`mt-1 text-sm font-semibold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('twoFactorSetup.needCodeBody')}</p>

                {invalid && (
                    <div className={`mt-4 p-3 rounded-md text-sm font-semibold ${dark ? 'bg-red-500/10 border border-red-400/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                        {t('twoFactorSetup.fail')}
                    </div>
                )}

                <div className="mt-5">
                    <label className={`block text-sm font-bold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{t('recovery.code')}</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        autoFocus
                        className={`mt-1 block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-gold text-center tracking-widest outline-none ${dark ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]' : 'bg-white border-gray-300 text-brand-charcoal'}`}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                    />
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={confirm}
                        className="flex-1 py-3.5 bg-brand-gold hover:bg-brand-gold-light text-brand-navy-dark font-black rounded-xl shadow-md transition-all duration-300"
                    >
                        {t('twoFactorSetup.submit')}
                    </button>
                    <button
                        type="button"
                        onClick={close}
                        className={`px-5 py-3.5 border font-bold rounded-xl transition-colors ${dark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-300 text-brand-charcoal hover:bg-gray-50'}`}
                    >
                        {t('twoFactorSetup.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
}