"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BackHomeButton from '@/components/BackHomeButton';

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-brand-navy-dark dark:text-gray-300 text-gray-600 font-bold">Loading...</div>}>
            <VerifyEmailForm />
        </Suspense>
    );
}

function VerifyEmailForm() {
    const [state, setState] = useState<'verifying' | 'verified' | 'failed'>('verifying');
    const [error, setError] = useState('');
    const { t } = useI18n();
    const { dark } = useTheme();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token') || '';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!token) {
                setState('failed');
                return;
            }
            try {
                await api.post('/auth/verify-email', { token });
                if (!cancelled) setState('verified');
            } catch (err) {
                if (!cancelled) {
                    setError(getErrorMessage(err) || t('common.error'));
                    setState('failed');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

    return (
        <div className={`min-h-screen flex items-center justify-center relative overflow-hidden p-4 ${dark ? 'bg-brand-navy-dark' : 'bg-gray-50'}`}>
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-gold/10 rounded-full blur-[100px] animate-float opacity-70"></div>
                <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-brand-gold/5 rounded-full blur-[120px] animate-float opacity-70" style={{ animationDelay: '2s', animationDuration: '8s' }}></div>
            </div>

            <div className={`absolute top-6 right-6 rtl:left-6 rtl:right-auto z-50 rounded-full shadow-sm border p-1 ${dark ? 'bg-white/5 backdrop-blur-md border-white/10' : 'bg-white border-gray-200'}`}>
                <LanguageSwitcher />
            </div>
            <BackHomeButton />
            <div className={`w-full max-w-md backdrop-blur-2xl p-6 sm:p-10 rounded-[2rem] relative z-10 transition-all duration-500 text-center ${dark ? 'bg-brand-navy-dark/90 shadow-[0_20px_60px_rgb(0,0,0,0.4)] border border-white/10 hover:border-white/20' : 'bg-white shadow-xl border border-gray-200 hover:shadow-2xl'}`}>
                <h1 className={`text-3xl font-black mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>laxa<span className="text-brand-gold">lab</span></h1>

                {state === 'verifying' && (
                    <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full border-4 border-brand-gold border-t-transparent animate-spin mb-4"></div>
                        <p className={`font-bold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('recovery.verifying')}</p>
                    </div>
                )}

                {state === 'verified' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/15 flex items-center justify-center text-2xl text-green-500">&#10003;</div>
                        <h2 className={`text-lg font-bold ${dark ? 'text-white' : 'text-brand-navy'}`}>{t('recovery.verified')}</h2>
                        <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('recovery.verifiedBody')}</p>
                        <a href="/login" className="inline-block mt-2 px-6 py-3 bg-brand-gold hover:bg-brand-gold-light text-brand-navy-dark font-black rounded-xl">
                            {t('recovery.goToLogin')}
                        </a>
                    </div>
                )}

                {state === 'failed' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/15 flex items-center justify-center text-2xl text-red-500">&#10007;</div>
                        <p className={`text-sm font-semibold ${dark ? 'text-red-400' : 'text-red-600'}`}>{error || t('recovery.verifyFail')}</p>
                        <a href="/login" className={`inline-block mt-2 font-bold transition-colors ${dark ? 'text-brand-gold-light hover:text-brand-gold' : 'text-brand-gold-dark hover:text-brand-gold'}`}>{t('recovery.backToLogin')}</a>
                    </div>
                )}
            </div>
        </div>
    );
}