"use client";

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import {
    Loader, Plus, Pencil, Trash2, X, Megaphone, Eye, EyeOff, Calendar, User, Search,
} from 'lucide-react';
import { EmptyPanel, BtnPrimary } from '@/app/dashboard/admin/components';

interface Announcement {
    id: string;
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    author?: { id: string; email: string } | null;
}

interface AnnouncementForm {
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
    isPublished: boolean;
}

const emptyForm: AnnouncementForm = {
    titleAr: '',
    titleEn: '',
    contentAr: '',
    contentEn: '',
    isPublished: false,
};

export default function InstructorAnnouncements({ openingId }: { openingId: string }) {
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';

    const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [form, setForm] = useState<AnnouncementForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get(`/announcements/opening/${openingId}`);
            setAnnouncements(res.data);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('adminAnnouncements.save_failed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [openingId]);

    const filtered = (announcements || []).filter(a => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (a.titleAr || '').toLowerCase().includes(q) ||
               (a.titleEn || '').toLowerCase().includes(q) ||
               (a.contentAr || '').toLowerCase().includes(q) ||
               (a.contentEn || '').toLowerCase().includes(q);
    });

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEdit = (a: Announcement) => {
        setEditing(a);
        setForm({
            titleAr: a.titleAr,
            titleEn: a.titleEn,
            contentAr: a.contentAr,
            contentEn: a.contentEn,
            isPublished: a.isPublished,
        });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.titleAr.trim() || !form.titleEn.trim()) {
            toast.error(isAr ? 'أدخل العنوان بالعربي والإنجليزي' : 'Enter title in Arabic and English');
            return;
        }
        if (!form.contentAr.trim() || !form.contentEn.trim()) {
            toast.error(isAr ? 'أدخل المحتوى بالعربي والإنجليزي' : 'Enter content in Arabic and English');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await api.patch(`/announcements/${editing.id}`, form);
                toast.success(isAr ? 'تم تحديث الإعلان' : 'Announcement updated');
            } else {
                await api.post(`/announcements/opening/${openingId}`, form);
                toast.success(isAr ? 'تم إنشاء الإعلان' : 'Announcement created');
            }
            setModalOpen(false);
            load(true);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('adminAnnouncements.save_failed'));
        } finally {
            setSaving(false);
        }
    };

    const togglePublish = async (a: Announcement) => {
        try {
            await api.patch(`/announcements/${a.id}/toggle-publish`);
            toast.success(isAr ? 'تم تحديث حالة النشر' : 'Publish status updated');
            load(true);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('adminAnnouncements.save_failed'));
        }
    };

    const remove = async (id: string) => {
        if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الإعلان؟' : 'Are you sure you want to delete this announcement?')) return;
        try {
            await api.delete(`/announcements/${id}`);
            toast.success(isAr ? 'تم حذف الإعلان' : 'Announcement deleted');
            load(true);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('adminAnnouncements.save_failed'));
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                        type="text"
                        placeholder={isAr ? 'بحث في الإعلانات...' : 'Search announcements...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                </div>
                <BtnPrimary onClick={openCreate}>
                    <Plus size={16} /> {isAr ? 'إعلان جديد' : 'New Announcement'}
                </BtnPrimary>
            </div>

            {filtered.length === 0 ? (
                <EmptyPanel icon={Megaphone} title={isAr ? 'لا توجد إعلانات بعد' : 'No announcements yet'} />
            ) : (
                <div className="space-y-3">
                    {filtered.map((a) => (
                        <div
                            key={a.id}
                            className="bg-surface-sunken border border-line rounded-2xl p-5 hover:border-brand-gold/20 transition-all duration-200"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <h3 className="text-ink font-bold text-base">
                                            {isAr ? a.titleAr : a.titleEn}
                                        </h3>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                            a.isPublished
                                                ? 'bg-green-500/10 text-green-900 dark:text-green-400 border border-green-500/20'
                                                : 'bg-ink/[0.01] text-ink-muted border border-line'
                                        }`}>
                                            {a.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                                            {a.isPublished ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
                                        </span>
                                    </div>
                                    <p className="text-ink-muted text-sm line-clamp-2 mb-3">
                                        {isAr ? a.contentAr : a.contentEn}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(a.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                        </span>
                                        {a.author && (
                                            <span className="flex min-w-0 items-center gap-1">
                                                <User size={12} />
                                                <span className="min-w-0 truncate">{a.author.email}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => togglePublish(a)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            a.isPublished
                                                ? 'bg-green-500/10 text-green-900 dark:text-green-400 hover:bg-green-500/20'
                                                : 'bg-ink/[0.01] text-ink-muted hover:bg-ink/[0.02]'
                                        }`}
                                        title={a.isPublished ? (isAr ? 'إلغاء النشر' : 'Unpublish') : (isAr ? 'نشر' : 'Publish')}
                                    >
                                        {a.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button
                                        onClick={() => openEdit(a)}
                                        className="p-2 rounded-lg bg-brand-gold/10 text-gold-ink hover:bg-brand-gold/20 transition-colors"
                                        title={isAr ? 'تعديل' : 'Edit'}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => remove(a.id)}
                                        className="p-2 rounded-lg bg-red-500/10 text-red-800 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                                        title={isAr ? 'حذف' : 'Delete'}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
                    <div
                        className="bg-surface border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-line">
                            <h3 className="text-lg font-black text-ink">
                                {editing ? (isAr ? 'تعديل الإعلان' : 'Edit Announcement') : (isAr ? 'إعلان جديد' : 'New Announcement')}
                            </h3>
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
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                        placeholder={isAr ? 'عنوان الإعلان بالعربي' : 'Announcement title in Arabic'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'العنوان بالإنجليزي' : 'Title (English)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleEn}
                                        onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                        placeholder={isAr ? 'عنوان الإعلان بالإنجليزي' : 'Announcement title in English'}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'المحتوى بالعربي' : 'Content (Arabic)'}</label>
                                    <textarea
                                        value={form.contentAr}
                                        onChange={(e) => setForm({ ...form, contentAr: e.target.value })}
                                        rows={5}
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                        placeholder={isAr ? 'محتوى الإعلان بالعربي' : 'Announcement content in Arabic'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'المحتوى بالإنجليزي' : 'Content (English)'}</label>
                                    <textarea
                                        value={form.contentEn}
                                        onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                                        rows={5}
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                        placeholder={isAr ? 'محتوى الإعلان بالإنجليزي' : 'Announcement content in English'}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isPublished}
                                        onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                                        className="w-4 h-4 rounded border-line-strong bg-ink/[0.04] text-accent focus:ring-brand-gold/50"
                                    />
                                    <span className="text-sm text-ink-muted font-bold">{isAr ? 'نشر فوراً' : 'Publish immediately'}</span>
                                </label>
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
                                onClick={save}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <Loader size={14} className="animate-spin" />}
                                {editing ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إنشاء' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
