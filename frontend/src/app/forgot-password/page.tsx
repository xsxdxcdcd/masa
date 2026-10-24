"use client";

import { useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BackHomeButton from '@/components/BackHomeButton';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { t } = useI18n();
    const { dark } = useTheme();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            setError('');
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err) {
            setError(getErrorMessage(err) || t('common.error_generic'));
        } finally {
            setSubmitting(false);
        }
    };

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
            <div className={`w-full max-w-md backdrop-blur-2xl p-6 sm:p-10 rounded-[2rem] relative z-10 transition-all duration-500 ${dark ? 'bg-brand-navy-dark/90 shadow-[0_20px_60px_rgb(0,0,0,0.4)] border border-white/10 hover:border-white/20' : 'bg-white shadow-xl border border-gray-200 hover:shadow-2xl'}`}>
                <div className="text-center mb-8">
                    <h1 className={`text-3xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>laxa<span className="text-brand-gold">lab</span></h1>
                    <p className={`mt-2 font-bold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t('recovery.forgotTitle')}</p>
                </div>

                {sent ? (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/15 flex items-center justify-center text-2xl text-green-500">&#10003;</div>
                        <h2 className={`text-lg font-bold ${dark ? 'text-white' : 'text-brand-navy'}`}>{t('recovery.sentTitle')}</h2>
                        <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('recovery.sentBody')}</p>
                        <a href="/login" className={`inline-block mt-2 font-bold transition-colors ${dark ? 'text-brand-gold-light hover:text-brand-gold' : 'text-brand-gold-dark hover:text-brand-gold'}`}>{t('recovery.backToLogin')}</a>
                    </div>
                ) : (
                    <>
                        <p className={`text-sm text-center mb-4 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('recovery.forgotSub')}</p>

                        {error && <div className={`mb-4 p-3 rounded-md text-sm font-semibold ${dark ? 'bg-red-500/10 border border-red-400/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-bold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{t('recovery.emailLabel')}</label>
                                <input
                                    type="email"
                                    required
                                    className={`mt-1 block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-gold ${dark ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]' : 'bg-white border-gray-300 text-brand-charcoal'}`}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <button type="submit" disabled={submitting} className="w-full py-4 bg-brand-gold hover:bg-brand-gold-light text-brand-navy-dark font-black rounded-xl shadow-md transition disabled:opacity-60">
                                {submitting ? t('common.processing') : t('recovery.sendResetLink')}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <a href="/login" className={`text-sm font-bold transition-colors ${dark ? 'text-brand-gold-light hover:text-brand-gold' : 'text-brand-gold-dark hover:text-brand-gold'}`}>{t('recovery.backToLogin')}</a>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}