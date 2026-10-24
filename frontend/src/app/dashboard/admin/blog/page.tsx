"use client";

import { useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useFetchData } from '@/lib/useFetchData';

interface Post {
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
}

interface PostForm {
    titleEn: string;
    titleAr: string;
    contentEn: string;
    contentAr: string;
    excerptEn: string;
    excerptAr: string;
    slug: string;
    coverImageUrl: string;
}

const EMPTY_FORM: PostForm = { titleEn: '', titleAr: '', contentEn: '', contentAr: '', excerptEn: '', excerptAr: '', slug: '', coverImageUrl: '' };

export default function AdminBlogPage() {
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';
    const { data: posts, error: loadError, refetch } = useFetchData<Post[]>('/api/admin/blog');
    const [editing, setEditing] = useState<Post | null>(null);
    const [form, setForm] = useState<PostForm>(EMPTY_FORM);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const startNew = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
    };

    const startEdit = (post: Post) => {
        setEditing(post);
        setForm({
            titleEn: post.titleEn || '',
            titleAr: post.titleAr || '',
            contentEn: post.contentEn || '',
            contentAr: post.contentAr || '',
            excerptEn: post.excerptEn || '',
            excerptAr: post.excerptAr || '',
            slug: post.slug || '',
            coverImageUrl: post.coverImageUrl || '',
        });
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            if (editing?.id) {
                const res = await api.patch(`/api/admin/blog/${editing.id}`, form);
                setEditing(res.data);
            } else {
                const res = await api.post('/api/admin/blog', form);
                setEditing(res.data);
            }
            await refetch();
        } catch (err) {
            setError(getErrorMessage(err) || t('common.error'));
        } finally {
            setBusy(false);
        }
    };

    const publish = async (post: Post, makePublished: boolean) => {
        try {
            await api.post(`/api/admin/blog/${post.id}/${makePublished ? 'publish' : 'unpublish'}`);
            await refetch();
        } catch (err) {
            setError(getErrorMessage(err) || t('common.error'));
        }
    };

    const remove = async (post: Post) => {
        if (!confirm(t('blog.confirmDelete'))) return;
        try {
            await api.delete(`/api/admin/blog/${post.id}`);
            if (editing?.id === post.id) startNew();
            await refetch();
        } catch (err) {
            setError(getErrorMessage(err) || t('common.error'));
        }
    };

    const inputCls = "mt-1 block w-full px-3 py-2.5 bg-white dark:bg-brand-navy-dark border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-sm text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500";
    const labelCls = "block text-sm font-bold text-gray-600 dark:text-gray-300";

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between mb-6">
                <h1 className="text-2xl font-black text-brand-navy dark:text-white">{t('blog.manageTitle')}</h1>
                <button onClick={startNew} className="px-4 py-2.5 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-dark hover:to-brand-gold-dark text-black font-black rounded-xl transition text-sm">
                    + {t('blog.newPost')}
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-md text-sm font-semibold">{error}</div>}
            {loadError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-md text-sm font-semibold">{loadError}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-brand-navy-dark rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm p-5">
                    <h2 className="font-black text-brand-navy dark:text-white mb-4">{editing?.id ? t('blog.editPost') : t('blog.newPost')}</h2>
                    <form onSubmit={save} className="space-y-3">
                        <div>
                            <label className={labelCls}>{t('blog.titleEn')}</label>
                            <input className={inputCls} required value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('blog.titleAr')}</label>
                            <input className={inputCls} required value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('blog.excerptEn')}</label>
                            <input className={inputCls} value={form.excerptEn} onChange={(e) => setForm({ ...form, excerptEn: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('blog.excerptAr')}</label>
                            <input className={inputCls} value={form.excerptAr} onChange={(e) => setForm({ ...form, excerptAr: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('blog.contentEn')}</label>
                            <textarea className={inputCls} rows={4} required value={form.contentEn} onChange={(e) => setForm({ ...form, contentEn: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('blog.contentAr')}</label>
                            <textarea className={inputCls} rows={4} required value={form.contentAr} onChange={(e) => setForm({ ...form, contentAr: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>{t('blog.slug')}</label>
                                <input className={`${inputCls} ltr`} dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('blog.coverUrl')}</label>
                                <input className={`${inputCls} ltr`} dir="ltr" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} />
                            </div>
                        </div>
                        <button type="submit" disabled={busy} className="w-full py-3 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-dark hover:to-brand-gold-dark text-black font-black rounded-xl transition disabled:opacity-60 text-sm">
                            {busy ? t('common.processing') : t('blog.savePost')}
                        </button>
                    </form>
                </div>

                <div className="bg-white dark:bg-brand-navy-dark rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm p-5 space-y-3">
                    <h2 className="font-black text-brand-navy dark:text-white mb-2">{isAr ? 'المقالات' : 'Posts'}</h2>
                    {posts?.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">{t('blog.empty')}</p>}
                    {posts?.map((post) => (
                        <div key={post.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/5 hover:border-brand-gold/30 transition">
                            <div className="min-w-0">
                                <p className="font-bold text-brand-navy dark:text-white truncate">{isAr ? post.titleAr : post.titleEn}</p>
                                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${post.isPublished ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}>
                                    {post.isPublished ? t('blog.published') : t('blog.draft')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => startEdit(post)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold text-gray-600 dark:text-gray-300 transition">{t('common.edit')}</button>
                                <button onClick={() => publish(post, !post.isPublished)} className="px-3 py-1.5 rounded-lg bg-brand-gold/10 hover:bg-brand-gold/20 text-xs font-bold text-brand-gold-dark dark:text-brand-gold-light transition">
                                    {post.isPublished ? t('blog.unpublish') : t('blog.publish')}
                                </button>
                                <button onClick={() => remove(post)} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-xs font-bold text-red-600 dark:text-red-400 transition">{t('blog.deletePost')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
