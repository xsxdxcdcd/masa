"use client";

import { useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import {
    BookOpen, ChevronDown, GraduationCap, Layers, Loader, Lock, Pencil,
    Plus, Route, Trash2, X, Zap,
} from 'lucide-react';

interface PathCourseItem {
    id: string;
    orderIndex: number;
    course?: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
}

interface LearningPathData {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    coverImageUrl?: string | null;
    isPublished: boolean;
    createdAt: string;
    creator?: { id: string; email?: string } | null;
    courses?: PathCourseItem[];
}

interface PathForm {
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    coverImageUrl: string;
    isPublished: boolean;
}

interface Props {
    mode?: 'browse' | 'manage';
}

const emptyPathForm: PathForm = {
    titleAr: '',
    titleEn: '',
    descriptionAr: '',
    descriptionEn: '',
    coverImageUrl: '',
    isPublished: false,
};

const GRADIENTS = [
    'from-brand-gold/40 via-brand-navy-dark to-brand-navy',
    'from-brand-navy-light/30 via-brand-navy-dark to-brand-navy',
    'from-purple-500/25 via-brand-navy-dark to-brand-navy',
    'from-emerald-500/25 via-brand-navy-dark to-brand-navy',
];

export default function LearningPathList({ mode = 'browse' }: Props) {
    const { t, locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const { user } = useAuth();

    const canManage = ['ADMIN', 'INSTRUCTOR'].includes(user?.role || '');
    const manage = mode === 'manage' && canManage;

    const { data, loading, error, refetch } = useFetchData<LearningPathData[]>('/learning-paths');

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<LearningPathData | null>(null);
    const [form, setForm] = useState<PathForm>(emptyPathForm);
    const [saving, setSaving] = useState(false);

    const paths = useMemo(() => {
        const list = data || [];
        return manage ? list : list.filter((p) => p.isPublished !== false);
    }, [data, manage]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyPathForm);
        setModalOpen(true);
    };

    const openEdit = (p: LearningPathData) => {
        setEditing(p);
        setForm({
            titleAr: p.titleAr || '',
            titleEn: p.titleEn || '',
            descriptionAr: p.descriptionAr || '',
            descriptionEn: p.descriptionEn || '',
            coverImageUrl: p.coverImageUrl || '',
            isPublished: !!p.isPublished,
        });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.titleAr.trim() || !form.titleEn.trim()) {
            toast.error(isAr ? 'أدخل العنوان بالعربي والإنجليزي' : 'Enter the title in Arabic and English');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                titleAr: form.titleAr.trim(),
                titleEn: form.titleEn.trim(),
                descriptionAr: form.descriptionAr.trim() || undefined,
                descriptionEn: form.descriptionEn.trim() || undefined,
                coverImageUrl: form.coverImageUrl.trim() || undefined,
                isPublished: form.isPublished,
            };
            if (editing) {
                await api.patch(`/learning-paths/${editing.id}`, payload);
                toast.success(isAr ? 'تم تحديث المسار' : 'Learning path updated');
            } else {
                await api.post('/learning-paths', payload);
                toast.success(isAr ? 'تم إنشاء المسار' : 'Learning path created');
            }
            setModalOpen(false);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const enroll = async (p: LearningPathData) => {
        setEnrollingId(p.id);
        try {
            await api.post(`/learning-paths/${p.id}/enroll`);
            const count = p.courses?.length ?? 0;
            toast.success(count > 0
                ? (isAr ? `تم تسجيلك في المسار وتفعيل ${count} دورة` : `Enrolled! ${count} course${count === 1 ? '' : 's'} activated`)
                : (isAr ? 'تم تسجيلك في المسار' : 'Enrolled in learning path'));
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setEnrollingId(null);
        }
    };

    const remove = async (p: LearningPathData) => {
        if (!confirm(isAr ? `هل أنت متأكد من حذف مسار "${pick(p, 'title')}"؟` : `Delete the path "${pick(p, 'title')}"?`)) return;
        setDeletingId(p.id);
        try {
            await api.delete(`/learning-paths/${p.id}`);
            toast.success(isAr ? 'تم حذف المسار' : 'Learning path deleted');
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setDeletingId(null);
        }
    };

    if (!manage && mode === 'manage') {
        return (
            <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-8 text-center">
                <Lock size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 font-bold text-sm">
                    {isAr ? 'إدارة المسارات متاحة للمدراء والمدرسين فقط' : 'Path management is available to admins and instructors only'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                    <Route size={20} className="text-brand-gold-light" />
                    {isAr ? 'مسارات التعلم' : 'Learning Paths'}
                    <span className="text-xs font-bold text-gray-500">({paths.length})</span>
                </h3>
                {manage && (
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition"
                    >
                        <Plus size={16} /> {isAr ? 'مسار جديد' : 'New Path'}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader size={28} className="animate-spin text-brand-gold-light" />
                </div>
            ) : error ? (
                <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-8 text-center">
                    <Route size={32} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 font-bold text-sm">{error}</p>
                </div>
            ) : paths.length === 0 ? (
                <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-10 text-center">
                    <Layers size={32} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 font-bold text-sm">{isAr ? 'لا توجد مسارات تعلم بعد' : 'No learning paths yet'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paths.map((p, idx) => {
                        const courses = [...(p.courses || [])].sort((a, b) => a.orderIndex - b.orderIndex);
                        const expanded = expandedId === p.id;
                        return (
                            <div
                                key={p.id}
                                className={`bg-brand-navy-dark border rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${
                                    expanded ? 'border-brand-gold/30' : 'border-white/5 hover:border-white/15'
                                }`}
                            >
                                {/* Cover */}
                                <div className={`relative h-28 bg-gradient-to-br ${GRADIENTS[idx % GRADIENTS.length]} flex items-end p-4`}>
                                    {p.coverImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                    ) : null}
                                    <div className="relative z-10 w-full flex items-start justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm text-[11px] font-bold text-white border border-white/10">
                                            <BookOpen size={12} className="text-brand-gold-light" />
                                            {courses.length} {isAr ? 'دورة' : courses.length === 1 ? 'course' : 'courses'}
                                        </span>
                                        {mode === 'manage' && (
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black backdrop-blur-sm border ${
                                                p.isPublished
                                                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                                    : 'bg-gray-900/50 text-gray-400 border-white/10'
                                            }`}>
                                                {p.isPublished ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col">
                                    <h4 className="text-white font-black leading-snug">{pick(p, 'title')}</h4>
                                    {pick(p, 'description') && (
                                        <p className="text-gray-400 text-xs mt-1.5 leading-relaxed line-clamp-2">{pick(p, 'description')}</p>
                                    )}

                                    {expanded && (
                                        <div className="mt-4 space-y-2 animate-fade-in">
                                            {courses.length === 0 ? (
                                                <p className="text-[11px] text-gray-500 font-bold">{isAr ? 'لا توجد دورات في هذا المسار بعد' : 'No courses in this path yet'}</p>
                                            ) : (
                                                courses.map((pc, i) => (
                                                    <div key={pc.id} className="flex items-center gap-2.5 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                                                        <span className="w-6 h-6 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold-light text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                                                            {i + 1}
                                                        </span>
                                                        <span className="text-xs font-bold text-gray-200 truncate">
                                                            {pick(pc.course, 'title') || (isAr ? 'دورة' : 'Course')}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 flex items-center gap-2">
                                        <button
                                            onClick={() => setExpandedId(expanded ? null : p.id)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition"
                                        >
                                            {isAr ? 'الدورات' : 'Courses'}
                                            <ChevronDown size={13} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        {!manage && (
                                            <button
                                                onClick={() => enroll(p)}
                                                disabled={enrollingId === p.id}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition disabled:opacity-50"
                                            >
                                                {enrollingId === p.id ? <Loader size={13} className="animate-spin" /> : <Zap size={13} />}
                                                {isAr ? 'التسجيل في المسار' : 'Enroll'}
                                            </button>
                                        )}
                                        {manage && (
                                            <>
                                                <button
                                                    onClick={() => openEdit(p)}
                                                    className="p-2 rounded-xl bg-brand-gold/10 text-brand-gold-light hover:bg-brand-gold/20 transition-colors"
                                                    title={isAr ? 'تعديل' : 'Edit'}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => remove(p)}
                                                    disabled={deletingId === p.id}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    title={isAr ? 'حذف' : 'Delete'}
                                                >
                                                    {deletingId === p.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
                    <div
                        className="bg-brand-navy border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h3 className="text-lg font-black text-white">
                                {editing ? (isAr ? 'تعديل المسار' : 'Edit Learning Path') : (isAr ? 'مسار تعلم جديد' : 'New Learning Path')}
                            </h3>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'العنوان بالعربي' : 'Title (Arabic)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleAr}
                                        onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'العنوان بالإنجليزي' : 'Title (English)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleEn}
                                        onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'الوصف بالعربي' : 'Description (Arabic)'}</label>
                                    <textarea
                                        value={form.descriptionAr}
                                        onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                                        rows={3}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'الوصف بالإنجليزي' : 'Description (English)'}</label>
                                    <textarea
                                        value={form.descriptionEn}
                                        onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                                        rows={3}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'رابط صورة الغلاف (اختياري)' : 'Cover image URL (optional)'}</label>
                                <input
                                    type="url"
                                    value={form.coverImageUrl}
                                    onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                                    dir="ltr"
                                    placeholder="https://..."
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isPublished}
                                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-brand-gold cursor-pointer"
                                />
                                <span className="text-sm text-gray-300 font-bold">{isAr ? 'منشور (مرئي للطلاب)' : 'Published (visible to students)'}</span>
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-t border-white/5">
                            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                                <GraduationCap size={13} />
                                {isAr ? 'أضف الدورات من صفحة تفاصيل المسار' : 'Add courses from the path details page'}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader size={14} className="animate-spin" />}
                                    {editing ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إنشاء' : 'Create')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
