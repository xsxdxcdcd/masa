"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Download, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface CertificateData {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: string;
    printedAt?: string | null;
    student?: { id: string; email: string } | null;
    holderName?: string;
    course?: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
}

export default function CertificateDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { t, pick, locale } = useI18n();
    const isAr = locale === 'ar';
    const { data: cert, loading, error } = useFetchData<CertificateData>(`/certificates/${id}`);

    // Resolved server-side; prefer the stored name over the email local-part.
    const studentName = cert?.holderName || user?.email?.split('@')[0] || '';

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <div className="space-y-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => router.push('/dashboard/profile?tab=certificates')}
                        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border border-white/10 bg-brand-navy-dark text-white hover:border-white/20 hover:bg-[#1a2d4a] transition"
                    >
                        <ArrowLeft size={16} className="rtl:rotate-180" /> {t('certificates.back')}
                    </button>
                </div>

                {error && <div className="p-4 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 rounded-xl">{error}</div>}

                {loading || !cert ? (
                    <div className="h-60 bg-brand-navy-dark flex items-center justify-center font-bold text-gray-400 rounded-3xl border border-white/5">
                        {t('certificates.loading')}
                    </div>
                ) : (
                    <div className="bg-brand-navy-dark rounded-3xl border border-white/5 shadow-sm overflow-hidden">
                        {/* Certificate preview */}
                        <div className="relative p-4 sm:p-6 lg:p-8 text-center">
                            <div className="absolute inset-3 border-2 border-white/5 rounded-2xl pointer-events-none" />
                            <div className="absolute inset-5 border border-white/[0.03] rounded-xl pointer-events-none" />

                            <div className="relative">
                                <div className="flex items-center justify-center gap-3 mb-6">
                                    <div className="w-14 h-14 bg-brand-navy rounded-2xl flex items-center justify-center border border-white/10">
                                        <span className="text-brand-gold-light font-black text-2xl">L</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-white tracking-tight">
                                        laxa<span className="text-brand-gold-light">lab</span>
                                    </h2>
                                </div>

                                <p className="text-sm uppercase tracking-[0.3em] text-gray-400 font-bold mb-4">
                                    {t('certificates.of_achievement')}
                                </p>

                                <h1 className="text-3xl sm:text-4xl font-black text-white mb-6">
                                    {t('certificates.certifies')}
                                </h1>

                                <div className="mb-8">
                                    <p className="text-sm text-gray-400 font-semibold mb-1">{t('certificates.student_name')}</p>
                                    <p className="text-2xl sm:text-3xl font-black text-white capitalize">{studentName}</p>
                                </div>

                                <div className="max-w-xl mx-auto mb-8">
                                    <p className="text-sm text-gray-400 font-semibold mb-1">{t('certificates.course_name')}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-white">
                                        {cert.course ? pick(cert.course, 'title') : t('certificates.unknown_course')}
                                    </p>
                                </div>

                                <p className="text-sm text-gray-400 font-semibold mb-2">{t('certificates.issue_date')}</p>
                                <p className="font-bold text-white mb-8">
                                    {new Date(cert.issuingDate).toLocaleDateString()}
                                </p>

                                <div className="flex items-center justify-center gap-6 text-xs text-gray-400 font-mono">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-green-400" />
                                        <span>{t('certificates.valid')}</span>
                                    </div>
                                    <div dir="ltr">#{cert.verificationCode}</div>
                                </div>
                            </div>
                        </div>

                        {/* Download buttons */}
                        <div className="border-t border-white/5 bg-white/[0.02] px-6 sm:px-10 py-6">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-center">
                                <Link
                                    href={`/certificate/${cert.id}?lang=en`}
                                    target="_blank"
                                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black font-black text-sm px-6 py-3.5 rounded-xl hover:opacity-95 transition-all duration-200 shadow-lg shadow-brand-gold/20"
                                >
                                    <Download size={16} />
                                    {t('certificates.download')} (English)
                                </Link>
                                <Link
                                    href={`/certificate/${cert.id}?lang=ar`}
                                    target="_blank"
                                    className="inline-flex items-center justify-center gap-2 bg-brand-navy border border-white/10 text-white font-black text-sm px-6 py-3.5 rounded-xl hover:bg-[#1a2d4a] transition-all duration-200"
                                >
                                    <Download size={16} />
                                    {t('certificates.download')} (العربية)
                                </Link>
                                <Link
                                    href={`/certificate/${cert.id}`}
                                    target="_blank"
                                    className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-300 font-bold text-sm px-6 py-3.5 rounded-xl hover:bg-white/10 transition-all duration-200"
                                >
                                    <Eye size={16} />
                                    {isAr ? 'معاينة' : 'Preview'}
                                </Link>
                            </div>
                            <p className="text-center text-gray-500 text-xs mt-4">
                                {t('certificates.verify_hint')} <strong dir="ltr" className="text-gray-400">{cert.verificationCode}</strong>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
