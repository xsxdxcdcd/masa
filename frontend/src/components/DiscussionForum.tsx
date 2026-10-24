"use client";

import { useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import {
    CheckCircle2, ChevronDown, Loader, MessageSquare, Pin, Plus,
    Send, Trash2, User, X,
} from 'lucide-react';

interface DiscussionAuthor {
    id: string;
    email?: string;
}

interface DiscussionReplyData {
    id: string;
    bodyAr: string;
    bodyEn: string;
    isAnswer?: boolean;
    createdAt: string;
    author?: DiscussionAuthor | null;
}

interface DiscussionPostData {
    id: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    isResolved: boolean;
    isPinned: boolean;
    createdAt: string;
    author?: DiscussionAuthor | null;
    replies?: DiscussionReplyData[];
    replyCount?: number;
}

interface Props {
    moduleId: string;
    courseId: string;
}

const emptyPostForm = {
    titleAr: '',
    titleEn: '',
    bodyAr: '',
    bodyEn: '',
};

export default function DiscussionForum({ moduleId }: Props) {
    const { t, locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const { user } = useAuth();

    const { data, loading, error, refetch } = useFetchData<DiscussionPostData[]>(`/discussions/module/${moduleId}/posts`);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyPostForm);
    const [creating, setCreating] = useState(false);
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const posts = useMemo(() => {
        const list = [...(data || [])];
        list.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return list;
    }, [data]);

    const isMine = (author?: DiscussionAuthor | null) => !!author?.id && author.id === user?.userId;

    const createPost = async () => {
        if (!form.titleAr.trim() || !form.titleEn.trim()) {
            toast.error(isAr ? 'أدخل العنوان بالعربي والإنجليزي' : 'Enter the title in Arabic and English');
            return;
        }
        if (!form.bodyAr.trim() || !form.bodyEn.trim()) {
            toast.error(isAr ? 'أدخل المحتوى بالعربي والإنجليزي' : 'Enter the body in Arabic and English');
            return;
        }
        setCreating(true);
        try {
            await api.post(`/discussions/module/${moduleId}/posts`, form);
            toast.success(isAr ? 'تم نشر المناقشة' : 'Discussion posted');
            setModalOpen(false);
            setForm(emptyPostForm);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setCreating(false);
        }
    };

    const sendReply = async (postId: string) => {
        const text = (replyDrafts[postId] || '').trim();
        if (!text) return;
        setReplyingTo(postId);
        try {
            await api.post(`/discussions/posts/${postId}/replies`, { bodyAr: text, bodyEn: text });
            toast.success(isAr ? 'تم إضافة الرد' : 'Reply added');
            setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setReplyingTo(null);
        }
    };

    const toggleResolved = async (post: DiscussionPostData) => {
        setResolvingId(post.id);
        try {
            await api.patch(`/discussions/posts/${post.id}/resolve`, { isResolved: !post.isResolved });
            toast.success(post.isResolved
                ? (isAr ? 'تم إعادة فتح النقاش' : 'Post reopened')
                : (isAr ? 'تم وضع علامة تم الحل' : 'Marked as resolved'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setResolvingId(null);
        }
    };

    const deletePost = async (post: DiscussionPostData) => {
        if (!confirm(isAr ? 'هل أنت متأكد من حذف هذه المناقشة؟' : 'Delete this discussion post?')) return;
        setDeletingId(post.id);
        try {
            await api.delete(`/discussions/posts/${post.id}`);
            toast.success(isAr ? 'تم حذف المناقشة' : 'Post deleted');
            if (expandedId === post.id) setExpandedId(null);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setDeletingId(null);
        }
    };

    const deleteReply = async (postId: string, replyId: string) => {
        if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الرد؟' : 'Delete this reply?')) return;
        setDeletingId(replyId);
        try {
            await api.delete(`/discussions/replies/${replyId}`);
            toast.success(isAr ? 'تم حذف الرد' : 'Reply deleted');
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader size={28} className="animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="flex items-center gap-2 text-lg font-black text-ink">
                    <MessageSquare size={20} className="text-accent" />
                    {isAr ? 'مناقشات الدرس' : 'Module Discussions'}
                    <span className="text-xs font-bold text-ink-subtle">({posts.length})</span>
                </h3>
                <button
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition"
                >
                    <Plus size={16} /> {isAr ? 'مناقشة جديدة' : 'New Post'}
                </button>
            </div>

            {error && (
                <p className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>
            )}

            {posts.length === 0 ? (
                <div className="text-center py-14 bg-surface-sunken border border-line rounded-2xl">
                    <MessageSquare size={32} className="mx-auto text-ink-subtle mb-3" />
                    <p className="text-ink-subtle font-bold text-sm">{isAr ? 'لا توجد مناقشات بعد — كن أول من يبدأ!' : 'No discussions yet — be the first to post!'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map((post) => {
                        const replies = post.replies || [];
                        const replyCount = typeof post.replyCount === 'number' ? post.replyCount : replies.length;
                        const expanded = expandedId === post.id;
                        return (
                            <div
                                key={post.id}
                                className={`bg-surface-sunken border rounded-2xl transition-all duration-200 ${
                                    expanded ? 'border-brand-gold/30' : 'border-line hover:border-line'
                                }`}
                            >
                                <button
                                    onClick={() => setExpandedId(expanded ? null : post.id)}
                                    className="w-full text-start p-5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                {post.isPinned && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-gold/10 text-gold-ink border border-brand-gold/30">
                                                        <Pin size={11} /> {isAr ? 'مثبت' : 'Pinned'}
                                                    </span>
                                                )}
                                                {post.isResolved && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/10 text-green-900 dark:text-green-400 border border-green-500/20">
                                                        <CheckCircle2 size={11} /> {isAr ? 'تم الحل' : 'Resolved'}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-ink font-bold leading-snug">{pick(post, 'title')}</h4>
                                            <p className="text-ink-subtle text-sm mt-1 line-clamp-2">{pick(post, 'body')}</p>
                                            <div className="flex items-center gap-3 mt-3 text-[11px] text-ink-subtle font-bold flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <User size={11} /> {post.author?.email || (isAr ? 'مستخدم' : 'User')}
                                                </span>
                                                <span>{new Date(post.createdAt).toLocaleDateString(isAr ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                <span className="text-accent">
                                                    {replyCount} {isAr ? 'رد' : replyCount === 1 ? 'reply' : 'replies'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronDown size={18} className={`text-ink-subtle shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {expanded && (
                                    <div className="px-5 pb-5 animate-fade-in">
                                        <div className="border-t border-line pt-4 space-y-3">
                                            {pick(post, 'body') && (
                                                <p className="text-ink-muted text-sm whitespace-pre-wrap bg-ink/[0.02] border border-line rounded-xl p-4">
                                                    {pick(post, 'body')}
                                                </p>
                                            )}

                                            {replies.length > 0 && (
                                                <div className="space-y-2.5 ps-4 border-s-2 border-line ms-2">
                                                    {replies.map((reply) => (
                                                        <div
                                                            key={reply.id}
                                                            className={`rounded-xl p-3.5 border ${
                                                                reply.isAnswer
                                                                    ? 'bg-green-500/5 border-green-500/25'
                                                                    : 'bg-ink/[0.02] border-line'
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2 text-[11px] font-bold text-ink-subtle min-w-0">
                                                                    <span className="w-6 h-6 rounded-full bg-ink/[0.04] border border-line flex items-center justify-center shrink-0">
                                                                        <User size={12} className="text-ink-subtle" />
                                                                    </span>
                                                                    <span className="truncate">{reply.author?.email || (isAr ? 'مستخدم' : 'User')}</span>
                                                                    <span>·</span>
                                                                    <span className="shrink-0">{new Date(reply.createdAt).toLocaleDateString(isAr ? 'ar' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                                                                    {reply.isAnswer && (
                                                                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-900 dark:text-green-400 border border-green-500/25">
                                                                            <CheckCircle2 size={10} /> {isAr ? 'إجابة' : 'Answer'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {isMine(reply.author) && (
                                                                    <button
                                                                        onClick={() => deleteReply(post.id, reply.id)}
                                                                        disabled={deletingId === reply.id}
                                                                        className="p-1.5 rounded-lg bg-red-500/10 text-red-800 dark:text-red-400 hover:bg-red-500/20 transition-colors shrink-0 disabled:opacity-50"
                                                                        title={isAr ? 'حذف' : 'Delete'}
                                                                    >
                                                                        {deletingId === reply.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-ink-muted text-sm mt-2 whitespace-pre-wrap break-words">{pick(reply, 'body')}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-end gap-2 pt-1">
                                                <textarea
                                                    value={replyDrafts[post.id] || ''}
                                                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                                    rows={2}
                                                    placeholder={isAr ? 'اكتب رداً...' : 'Write a reply...'}
                                                    className="flex-1 min-w-0 px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                                />
                                                <button
                                                    onClick={() => sendReply(post.id)}
                                                    disabled={replyingTo === post.id || !(replyDrafts[post.id] || '').trim()}
                                                    className="p-2.5 rounded-xl bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition disabled:opacity-40"
                                                    title={isAr ? 'رد' : 'Reply'}
                                                >
                                                    {replyingTo === post.id ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                                                </button>
                                            </div>

                                            {(isMine(post.author)) && (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <button
                                                        onClick={() => toggleResolved(post)}
                                                        disabled={resolvingId === post.id}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                                                            post.isResolved
                                                                ? 'bg-ink/[0.04] text-ink-muted hover:text-ink'
                                                                : 'bg-green-500/10 text-green-900 dark:text-green-400 border border-green-500/25 hover:bg-green-500/20'
                                                        }`}
                                                    >
                                                        {resolvingId === post.id ? <Loader size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                        {post.isResolved ? (isAr ? 'إعادة فتح' : 'Reopen') : (isAr ? 'تم الحل' : 'Mark as resolved')}
                                                    </button>
                                                    <button
                                                        onClick={() => deletePost(post)}
                                                        disabled={deletingId === post.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-800 dark:text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                                                    >
                                                        {deletingId === post.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                        {isAr ? 'حذف' : 'Delete'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
                    <div
                        className="bg-surface border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-line">
                            <h3 className="text-lg font-black text-ink">{isAr ? 'مناقشة جديدة' : 'New Discussion'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-ink-subtle hover:text-ink transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'العنوان بالعربي' : 'Title (Arabic)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleAr}
                                        onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                        placeholder={isAr ? 'عنوان المناقشة بالعربي' : 'Title in Arabic'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'العنوان بالإنجليزي' : 'Title (English)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleEn}
                                        onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                        placeholder={isAr ? 'عنوان المناقشة بالإنجليزي' : 'Title in English'}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'المحتوى بالعربي' : 'Body (Arabic)'}</label>
                                    <textarea
                                        value={form.bodyAr}
                                        onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
                                        rows={5}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                        placeholder={isAr ? 'اكتب سؤالك أو نقاشك بالعربي...' : 'Write your question in Arabic...'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'المحتوى بالإنجليزي' : 'Body (English)'}</label>
                                    <textarea
                                        value={form.bodyEn}
                                        onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
                                        rows={5}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                        placeholder={isAr ? 'اكتب سؤالك بالإنجليزي...' : 'Write your question in English...'}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-line">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-all"
                            >
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={createPost}
                                disabled={creating}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {creating && <Loader size={14} className="animate-spin" />}
                                {isAr ? 'نشر' : 'Post'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
