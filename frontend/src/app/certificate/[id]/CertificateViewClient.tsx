"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import CertificateBilingual from '@/components/CertificateBilingual';
import BackHomeButton from '@/components/BackHomeButton';
import { API_BASE_URL } from '@/lib/api';

interface CertData {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: string;
    student: { id: string } | null;
    holderName?: string;
    instructorName?: string;
    course: { id: string; titleAr: string | null; titleEn: string | null } | null;
}

function CertificateViewInner({ id }: { id: string }) {
    const searchParams = useSearchParams();
    const urlLang = searchParams.get('lang');
    const [cert, setCert] = useState<CertData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lang, setLang] = useState<'ar' | 'en'>(urlLang === 'ar' ? 'ar' : 'en');
    const [showSelector, setShowSelector] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/certificates/public/${id}`)
            .then(r => {
                if (!r.ok) throw new Error('not found');
                return r.json();
            })
            .then(data => {
                if (!data || !data.id) throw new Error('not found');
                setCert(data);
                setLoading(false);
            })
            .catch(() => {
                setError('Certificate not found');
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-brand-navy-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-brand-gold dark:border-white/10 dark:border-t-brand-gold-light rounded-full animate-spin" />
                    <p className="text-gray-600 dark:text-gray-400 font-bold">Loading certificate...</p>
                </div>
            </div>
        );
    }

    if (error || !cert) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-brand-navy-dark flex items-center justify-center px-4">
                <BackHomeButton />
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-brand-navy dark:text-white mb-2">Certificate Not Found</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">This certificate does not exist or has been revoked.</p>
                    <Link href="/verify-certificate" className="inline-flex items-center gap-2 bg-brand-navy dark:bg-white/10 text-white dark:text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-charcoal dark:hover:bg-white/15 transition">
                        Verify Another Certificate
                    </Link>
                </div>
            </div>
        );
    }

    // Names are resolved server-side; the public payload never carries the
    // email, so there is nothing to derive a name from here.
    const studentName = cert.holderName || 'Student';
    const instructorName = cert.instructorName || 'Instructor';
    const courseName = lang === 'ar' ? (cert.course?.titleAr || cert.course?.titleEn || 'Course') : (cert.course?.titleEn || cert.course?.titleAr || 'Course');
    const verificationUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify-certificate?code=${cert.verificationCode}`;

    if (showSelector) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-brand-navy-dark flex flex-col">
                {/* Header */}
                <header className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-brand-navy-dark/80 backdrop-blur-xl sticky top-0 z-50">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-gradient-to-br from-brand-gold to-brand-gold-dark rounded-lg flex items-center justify-center">
                            <span className="text-black font-black text-sm">L</span>
                        </div>
                        <span className="text-xl font-black text-brand-navy dark:text-white tracking-tight">
                            laxa<span className="text-brand-gold-dark dark:text-brand-gold-light">lab</span>
                        </span>
                    </Link>
                </header>

                {/* Language selector */}
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center max-w-lg">
                        <div className="w-20 h-20 bg-brand-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-brand-gold-dark dark:text-brand-gold-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-black text-brand-navy dark:text-white mb-3">Choose Language</h1>
                        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">اختر اللغة</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">Select the certificate language to view</p>
                        <div className="flex flex-wrap gap-4 justify-center w-full">
                            <button
                                onClick={() => { setLang('en'); setShowSelector(false); }}
                                className="bg-brand-navy dark:bg-white text-white dark:text-brand-navy-dark font-black text-lg px-6 sm:px-10 py-5 w-full sm:w-auto justify-center rounded-2xl hover:bg-brand-charcoal dark:hover:bg-gray-100 transition-all duration-200 flex items-center gap-3"
                            >
                                <span className="text-2xl">🇬🇧</span> English
                            </button>
                            <button
                                onClick={() => { setLang('ar'); setShowSelector(false); }}
                                className="bg-white border border-gray-200 text-brand-navy font-black text-lg px-6 sm:px-10 py-5 w-full sm:w-auto justify-center rounded-2xl hover:bg-gray-50 dark:bg-white/10 dark:border-white/10 dark:text-white dark:hover:bg-white/15 transition-all duration-200 flex items-center gap-3"
                            >
                                <span className="text-2xl">🇸🇦</span> العربية
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Home link — no-print, so it never lands on a saved or printed
                copy of the certificate */}
            <BackHomeButton className="no-print" />

            {/* Language toggle — no-print */}
            <div className="no-print fixed bottom-6 right-6 z-50 flex gap-2">
                <button
                    onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                    className="bg-brand-navy-dark border border-white/10 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-[#1a2d4a] transition shadow-xl flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    {lang === 'en' ? 'العربية' : 'English'}
                </button>
            </div>

            <CertificateBilingual
                studentName={studentName}
                courseName={courseName}
                instructorName={instructorName}
                issueDate={cert.issuingDate}
                verificationCode={cert.verificationCode}
                verificationUrl={verificationUrl}
                lang={lang}
            />

            {/* Verification badge — no-print */}
            <div className="no-print bg-gray-50 dark:bg-brand-navy-dark border-t border-gray-200 dark:border-white/5 py-8 px-4">
                <div className="max-w-2xl mx-auto text-center">
                    <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold ${
                        cert.verificationStatus === 'VALID'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${cert.verificationStatus === 'VALID' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {cert.verificationStatus === 'VALID' ? 'Verified Certificate' : 'Certificate Revoked'}
                    </div>
                    <p className="text-gray-500 text-xs mt-3 font-mono" dir="ltr">
                        ID: {cert.verificationCode}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function CertificateViewClient({ id }: { id: string }) {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-brand-navy-dark flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-brand-gold dark:border-white/10 dark:border-t-brand-gold-light rounded-full animate-spin" />
            </div>
        }>
            <CertificateViewInner id={id} />
        </Suspense>
    );
}