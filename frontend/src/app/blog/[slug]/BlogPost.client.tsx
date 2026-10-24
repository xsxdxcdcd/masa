"use client";

import Link from 'next/link';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';

interface BlogPostDetail {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    excerptAr?: string | null;
    excerptEn?: string | null;
    contentAr: string;
    contentEn: string;
    coverImageUrl?: string | null;
    isPublished: boolean;
    publishedAt?: string | null;
    createdAt: string;
    author?: { id: string; email: string } | null;
}

export default function BlogPost({ slug }: { slug: string }) {
    const { t, locale } = useI18n();
    const { dark } = useTheme();
    const isAr = locale === 'ar';
    const { data: post, error } = useFetchData<BlogPostDetail>(`/blog/${encodeURIComponent(slug)}`);

    if (error && !post) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center px-6 text-center ${dark ? 'bg-brand-navy-dark' : 'bg-gray-50'}`}>
                <h1 className={`text-3xl font-black mb-3 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'لم يتم العثور على المقالة' : 'Post not found'}</h1>
                <Link href="/blog" className={`font-bold transition-colors ${dark ? 'text-brand-gold hover:text-brand-gold-light' : 'text-brand-gold-dark hover:text-brand-gold'}`}>{t('blog.backToBlog')}</Link>
            </div>
        );
    }

    if (!post) {
        return <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-brand-navy-dark' : 'bg-gray-50'}`}><p className={`font-bold ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{t('common.loading')}</p></div>;
    }

    const body = (isAr ? post.contentAr : post.contentEn) || '';
    const paragraphs = body.split(/\n+/).filter(Boolean);
    const title = isAr ? post.titleAr : post.titleEn;
    const excerpt = isAr ? post.excerptAr : post.excerptEn;

    return (
        <div className={`min-h-screen pb-16 ${dark ? 'bg-brand-navy-dark' : 'bg-gray-50'}`}>
            <header className={`px-4 md:px-8 py-4 md:py-6 flex items-center justify-between gap-4 flex-wrap border-b backdrop-blur-md ${dark ? 'border-white/10 bg-brand-navy-dark/80' : 'border-gray-200 bg-white/80'}`}>
                <Link href="/" className={`text-xl md:text-2xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>
                    laxa<span className="text-brand-gold">lab</span>
                </Link>
                <nav className={`flex items-center gap-4 md:gap-6 text-xs md:text-sm font-bold ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Link href="/blog" className="hover:text-brand-gold transition">{t('blog.title')}</Link>
                    <Link href="/courses" className="hover:text-brand-gold transition">{isAr ? 'الدورات' : 'Courses'}</Link>
                    <Link href="/login" className={`transition ${dark ? 'text-brand-gold-light hover:text-brand-gold' : 'text-brand-gold-dark hover:text-brand-gold'}`}>{isAr ? 'تسجيل الدخول' : 'Sign in'}</Link>
                </nav>
            </header>

            <main className="max-w-3xl mx-auto px-4 md:px-6 py-12">
                <Link href="/blog" className={`text-sm font-bold mb-6 inline-block transition-colors ${dark ? 'text-brand-gold hover:text-brand-gold-light' : 'text-brand-gold-dark hover:text-brand-gold'}`}>&larr; {t('blog.backToPosts')}</Link>

                {post.coverImageUrl && (
                    <div className="w-full h-64 md:h-80 bg-brand-navy rounded-3xl overflow-hidden mb-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.coverImageUrl} alt={title} className="w-full h-full object-cover" />
                    </div>
                )}

                <h1 className={`text-3xl md:text-4xl font-black leading-tight mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>{title}</h1>
                <div className={`text-sm font-semibold mb-8 flex flex-wrap items-center gap-2 min-w-0 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <span className="min-w-0 truncate max-w-full">{t('blog.byAuthor')} {post.author?.email}</span>
                    <span className="shrink-0">•</span>
                    <span className="shrink-0">{t('blog.publishedOn')} {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}</span>
                </div>

                {excerpt && <p className={`font-semibold text-lg mb-6 leading-relaxed ${dark ? 'text-brand-mist' : 'text-brand-gold-dark'}`}>{excerpt}</p>}

                <article className={`prose prose-lg max-w-none leading-relaxed space-y-4 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {paragraphs.map((p: string, i: number) => (
                        <p key={i}>{p}</p>
                    ))}
                </article>
            </main>
        </div>
    );
}