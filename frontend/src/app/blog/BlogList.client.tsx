"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';

interface BlogPostSummary {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    excerptAr?: string | null;
    excerptEn?: string | null;
    coverImageUrl?: string | null;
    publishedAt?: string | null;
    author?: { id: string; email: string } | null;
}

interface BlogListData {
    total: number;
    page: number;
    pageSize: number;
    items: BlogPostSummary[];
}

export default function BlogList() {
    const { t, locale } = useI18n();
    const { dark } = useTheme();
    const isAr = locale === 'ar';
    const [page, setPage] = useState(1);
    const { data, loading } = useFetchData<BlogListData>(`/blog?page=${page}&pageSize=12`);

    const items = data?.items ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 12));

    const pagBtn = `px-4 py-2 rounded-xl border font-bold text-sm disabled:opacity-40 transition ${dark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-300 text-brand-navy hover:bg-gray-50'}`;

    return (
        <div className={`min-h-screen pb-16 ${dark ? 'bg-brand-navy-dark' : 'bg-gray-50'}`}>
            <header className={`px-4 md:px-8 py-4 md:py-6 flex items-center justify-between gap-4 flex-wrap border-b backdrop-blur-md ${dark ? 'border-white/10 bg-brand-navy-dark/80' : 'border-gray-200 bg-white/80'}`}>
                <Link href="/" className={`text-xl md:text-2xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>
                    laxa<span className="text-brand-gold">lab</span>
                </Link>
                <nav className={`flex items-center gap-4 md:gap-6 text-xs md:text-sm font-bold ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Link href="/courses" className="hover:text-brand-gold transition">{isAr ? 'الدورات' : 'Courses'}</Link>
                    <Link href="/verify-certificate" className="hover:text-brand-gold transition">{isAr ? 'التحقق من الشهادات' : 'Verify a certificate'}</Link>
                    <Link href="/login" className={`transition ${dark ? 'text-brand-gold-light hover:text-brand-gold' : 'text-brand-gold-dark hover:text-brand-gold'}`}>{isAr ? 'تسجيل الدخول' : 'Sign in'}</Link>
                </nav>
            </header>

            <main className="max-w-5xl mx-auto px-4 md:px-6 py-12">
                <div className="text-center mb-10">
                    <h1 className={`text-4xl font-black mb-2 ${dark ? 'text-white' : 'text-brand-navy'}`}>{t('blog.title')}</h1>
                    <p className={`font-semibold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('blog.subtitle')}</p>
                </div>

                {loading && <p className={`text-center font-bold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('common.loading')}</p>}

                {!loading && items.length === 0 && (
                    <p className={`text-center font-bold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('blog.empty')}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((post) => (
                        <Link key={post.id} href={`/blog/${post.slug}`} className={`rounded-2xl overflow-hidden border shadow-sm hover:shadow-lg transition group ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                            {post.coverImageUrl && (
                                <div className="h-40 w-full bg-brand-navy overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={post.coverImageUrl} alt={isAr ? post.titleAr : post.titleEn} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                </div>
                            )}
                            <div className="p-5">
                                <h2 className={`font-black text-lg mb-2 transition ${dark ? 'text-white group-hover:text-brand-gold' : 'text-brand-navy group-hover:text-brand-gold-dark'}`}>
                                    {isAr ? post.titleAr : post.titleEn}
                                </h2>
                                {(isAr ? post.excerptAr : post.excerptEn) && (
                                    <p className={`text-sm leading-relaxed line-clamp-2 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{isAr ? post.excerptAr : post.excerptEn}</p>
                                )}
                                <div className={`mt-4 flex items-center justify-between gap-2 min-w-0 text-xs font-semibold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <span className="min-w-0 truncate">{post.author?.email}</span>
                                    <span className="shrink-0">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-3">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className={pagBtn}>
                            {isAr ? 'السابق' : 'Previous'}
                        </button>
                        <span className={`text-sm font-bold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{page} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={pagBtn}>
                            {isAr ? 'التالي' : 'Next'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}