"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Tag, X, RefreshCw, Pencil, BarChart3, Ban } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnSoft } from '../../components';
import { formatPrice } from '@/lib/format';

interface CourseOption {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
}

interface CouponCourseLink {
    courseId: string;
    course?: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
}

interface Coupon {
    id: string;
    name: string;
    code: string;
    type: 'PERCENT' | 'AMOUNT';
    value: number | string;
    maxUses?: number | null;
    maxUsesScope: 'TOTAL' | 'PER_COURSE';
    usedCount: number;
    active: boolean;
    sourceName?: string | null;
    channel?: string | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    courses?: CouponCourseLink[] | null;
    _count?: { redemptions: number };
}

interface CouponStats {
    totalRedemptions: number;
    totalDiscount: number;
    perCourse: { courseId: string; titleAr?: string | null; titleEn?: string | null; count: number; discount: number }[];
    redemptions: {
        id: string;
        amountOff: number | string;
        usedAt: string;
        student?: { email: string } | null;
        course?: { titleAr?: string | null; titleEn?: string | null } | null;
    }[];
}

type CouponType = 'PERCENT' | 'AMOUNT';
type MaxScope = 'TOTAL' | 'PER_COURSE';

interface CouponForm {
    name: string;
    code: string;
    type: CouponType;
    value: string;
    maxUses: string;
    maxUsesScope: MaxScope;
    sourceName: string;
    channel: string;
    active: boolean;
    startsAt: string;
    expiresAt: string;
    courseIds: string[];
}

const emptyForm: CouponForm = {
    name: '',
    code: '',
    type: 'PERCENT',
    value: '',
    maxUses: '',
    maxUsesScope: 'TOTAL',
    sourceName: '',
    channel: '',
    active: true,
    startsAt: '',
    expiresAt: '',
    courseIds: [],
};

export default function AdminCouponsPage() {
    const { data: coupons, loading, error, refetch } = useFetchData<Coupon[]>('/api/admin/finance/coupons');
    const { data: courses } = useFetchData<CourseOption[]>('/courses');
    const { t, pick, locale } = useI18n();
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<CouponForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [statsCoupon, setStatsCoupon] = useState<Coupon | null>(null);
    const [stats, setStats] = useState<CouponStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowModal(true);
    };

    const openEdit = (c: Coupon) => {
        setForm({
            name: c.name || '',
            code: c.code,
            type: c.type,
            value: String(c.value ?? ''),
            maxUses: c.maxUses != null ? String(c.maxUses) : '',
            maxUsesScope: c.maxUsesScope || 'TOTAL',
            sourceName: c.sourceName || '',
            channel: c.channel || '',
            active: c.active,
            startsAt: c.startsAt ? c.startsAt.slice(0, 10) : '',
            expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
            courseIds: (c.courses || []).map((l) => l.courseId),
        });
        setEditingId(c.id);
        setShowModal(true);
    };

    const toggleCourse = (courseId: string) =>
        setForm((f) => ({
            ...f,
            courseIds: f.courseIds.includes(courseId)
                ? f.courseIds.filter((id) => id !== courseId)
                : [...f.courseIds, courseId],
        }));

    const handleSave = async () => {
        if (!form.name.trim() || !form.code.trim() || !form.value) {
            toast.error(t('finance.coupons.err_required'));
            return;
        }
        if (form.type === 'PERCENT' && Number(form.value) > 100) {
            toast.error(t('finance.coupons.err_percent_max'));
            return;
        }
        const payload = {
            name: form.name.trim(),
            code: form.code.trim(),
            type: form.type,
            value: Number(form.value),
            maxUses: form.maxUses ? Number(form.maxUses) : undefined,
            maxUsesScope: form.maxUsesScope,
            sourceName: form.sourceName.trim() || undefined,
            channel: form.channel.trim() || undefined,
            active: form.active,
            startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00`).toISOString() : undefined,
            expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : undefined,
            courseIds: form.courseIds,
        };
        setSaving(true);
        try {
            if (editingId) {
                await api.patch(`/api/admin/finance/coupons/${editingId}`, payload);
                toast.success(t('finance.coupons.updated'));
            } else {
                await api.post('/api/admin/finance/coupons', payload);
                toast.success(t('finance.coupons.created'));
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingId(null);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('finance.coupons.save_failed'));
        }
        setSaving(false);
    };

    const handleDelete = async (c: Coupon) => {
        if (!window.confirm(t('finance.coupons.delete_confirm').replace('{code}', c.code))) return;
        setDeletingId(c.id);
        try {
            await api.delete(`/api/admin/finance/coupons/${c.id}`);
            toast.success(t('finance.coupons.deleted'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('finance.coupons.delete_failed'));
        }
        setDeletingId(null);
    };

    const openStats = async (c: Coupon) => {
        setStatsCoupon(c);
        setStats(null);
        setStatsLoading(true);
        try {
            const res = await api.get(`/api/admin/finance/coupons/${c.id}/stats`);
            setStats(res.data);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('finance.coupons.stats_failed'));
        } finally {
            setStatsLoading(false);
        }
    };

    const discountLabel = (c: { type: CouponType; value: number | string }) =>
        c.type === 'PERCENT' ? `${Number(c.value)}%` : formatPrice(Number(c.value), { locale });

    const capLabel = (c: Coupon) => {
        if (c.maxUses == null) return t('finance.coupons.unlimited');
        const key = c.maxUsesScope === 'PER_COURSE' ? 'finance.coupons.cap_per_course' : 'finance.coupons.cap_total';
        return t(key).replace('{n}', String(c.maxUses));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('finance.coupons.title')}
                subtitle={t('finance.coupons.subtitle')}
                actions={
                    <div className="flex gap-2">
                        <BtnSoft icon={Plus} onClick={openCreate}>{t('finance.coupons.create')}</BtnSoft>
                        <BtnSoft icon={RefreshCw} onClick={refetch}>{t('admin.refresh')}</BtnSoft>
                    </div>
                }
            />

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
            ) : (
                <div className="admin-table-wrap bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('finance.coupons.col_coupon')}</th>
                                <th>{t('finance.coupons.col_discount')}</th>
                                <th>{t('finance.coupons.col_targeting')}</th>
                                <th className="text-center">{t('finance.coupons.col_uses')}</th>
                                <th className="text-center">{t('finance.coupons.col_redemptions')}</th>
                                <th>{t('finance.coupons.col_expiry')}</th>
                                <th className="text-right">{t('finance.coupons.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {(coupons || []).map(c => {
                                const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                                const notStarted = c.startsAt ? new Date(c.startsAt) > new Date() : false;
                                const exhausted = c.maxUses != null && c.maxUsesScope === 'TOTAL' && c.usedCount >= c.maxUses;
                                const redemptions = c._count?.redemptions ?? 0;
                                const targets = c.courses || [];
                                return (
                                    <tr key={c.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                        <td className="p-4">
                                            <div className="font-black text-brand-navy dark:text-white">{c.name || '—'}</div>
                                            <span className="inline-flex items-center gap-2 font-mono text-sm font-black text-brand-gold-dark dark:text-brand-gold-light mt-1">
                                                <Tag size={15} /> {c.code}
                                            </span>
                                            {(c.sourceName || c.channel) && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {c.sourceName}{c.sourceName && c.channel ? ' · ' : ''}{c.channel}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-black text-brand-gold-dark dark:text-brand-gold-light">{discountLabel(c)}</td>
                                        <td className="p-4">
                                            <Badge tone={targets.length ? 'blue' : 'purple'} dot={false}>
                                                {targets.length ? t('finance.coupons.courses_n').replace('{n}', String(targets.length)) : t('finance.coupons.all_courses')}
                                            </Badge>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {t('finance.coupons.cap')} {capLabel(c)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`font-bold ${exhausted ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                                {c.usedCount}{c.maxUses != null && c.maxUsesScope === 'TOTAL' ? ` / ${c.maxUses}` : ''}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-bold text-gray-600 dark:text-gray-300">{redemptions}</td>
                                        <td className="p-4 text-sm">
                                            {c.expiresAt ? (
                                                <span className={expired ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}>
                                                    {new Date(c.expiresAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB')}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 dark:text-gray-300">—</span>
                                            )}
                                            {notStarted && <div className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">{t('finance.coupons.not_started')}</div>}
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            {!c.active && (
                                                <Badge tone="gray" dot={false}><Ban size={12} /> {t('finance.coupons.inactive')}</Badge>
                                            )}
                                            <button
                                                onClick={() => openStats(c)}
                                                className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-white/10 px-3 py-2 rounded-lg text-sm font-bold transition cursor-pointer ms-1"
                                            >
                                                <BarChart3 size={15} /> {t('finance.coupons.stats')}
                                            </button>
                                            <button
                                                onClick={() => openEdit(c)}
                                                className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/20 px-3 py-2 rounded-lg text-sm font-bold transition cursor-pointer ms-1"
                                            >
                                                <Pencil size={15} /> {t('finance.coupons.edit')}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c)}
                                                disabled={deletingId === c.id}
                                                className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20 px-3 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40 cursor-pointer ms-1"
                                            >
                                                <Trash2 size={15} /> {t('finance.coupons.delete')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(coupons || []).length === 0 && (
                                <EmptyState icon={Tag} title={t('finance.coupons.empty')} color="gold" />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / edit coupon modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-brand-navy-dark border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-black text-white">{editingId ? t('finance.coupons.edit_title') : t('finance.coupons.create_title')}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.name')} *</label>
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder={t('finance.coupons.name_ph')}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.code')} *</label>
                                    <input
                                        value={form.code}
                                        onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                        placeholder="SUMMER25"
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white uppercase placeholder:text-gray-600 focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.type')} *</label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm(f => ({ ...f, type: e.target.value as CouponType }))}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    >
                                        <option value="PERCENT">{t('finance.coupons.type_percent')}</option>
                                        <option value="AMOUNT">{t('finance.coupons.type_amount')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.value')} *</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.value}
                                        onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                                        placeholder={form.type === 'PERCENT' ? '25' : '50'}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.max_uses')}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.maxUses}
                                        onChange={(e) => setForm(f => ({ ...f, maxUses: e.target.value }))}
                                        placeholder={t('finance.coupons.max_uses_ph')}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.limit_scope')}</label>
                                    <select
                                        value={form.maxUsesScope}
                                        onChange={(e) => setForm(f => ({ ...f, maxUsesScope: e.target.value as MaxScope }))}
                                        disabled={!form.maxUses}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white focus:ring-2 focus:ring-brand-gold-light outline-none transition disabled:opacity-50"
                                    >
                                        <option value="TOTAL">{t('finance.coupons.scope_total')}</option>
                                        <option value="PER_COURSE">{t('finance.coupons.scope_per_course')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.source')}</label>
                                    <input
                                        value={form.sourceName}
                                        onChange={(e) => setForm(f => ({ ...f, sourceName: e.target.value }))}
                                        placeholder={t('finance.coupons.source_ph')}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.channel')}</label>
                                    <input
                                        value={form.channel}
                                        onChange={(e) => setForm(f => ({ ...f, channel: e.target.value }))}
                                        placeholder={t('finance.coupons.channel_ph')}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.starts_at')}</label>
                                    <input
                                        type="date"
                                        value={form.startsAt}
                                        onChange={(e) => setForm(f => ({ ...f, startsAt: e.target.value }))}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.expiry_date')}</label>
                                    <input
                                        type="date"
                                        value={form.expiresAt}
                                        onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-brand-navy-dark text-white focus:ring-2 focus:ring-brand-gold-light outline-none transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('finance.coupons.targeting')}</label>
                                <p className="text-xs text-gray-500 mb-2">{t('finance.coupons.targeting_hint')}</p>
                                <div className="max-h-44 overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5">
                                    {(courses || []).map((course) => (
                                        <label key={course.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition">
                                            <input
                                                type="checkbox"
                                                checked={form.courseIds.includes(course.id)}
                                                onChange={() => toggleCourse(course.id)}
                                                className="accent-brand-gold"
                                            />
                                            <span className="text-sm text-gray-200">{pick(course, 'title')}</span>
                                        </label>
                                    ))}
                                    {(courses || []).length === 0 && (
                                        <div className="p-3 text-sm text-gray-500">{t('finance.coupons.no_courses')}</div>
                                    )}
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.active}
                                    onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))}
                                    className="accent-brand-gold"
                                />
                                <span className="text-sm font-bold text-gray-300">{t('finance.coupons.active')}</span>
                            </label>
                        </div>
                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:opacity-90 text-black font-black py-3.5 rounded-xl shadow-md shadow-brand-gold/25 disabled:opacity-50 transition cursor-pointer"
                            >
                                {saving ? t('finance.coupons.saving') : editingId ? t('finance.coupons.save_changes') : t('finance.coupons.create')}
                            </button>
                            <BtnSoft onClick={() => setShowModal(false)}>{t('finance.coupons.cancel')}</BtnSoft>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats modal */}
            {statsCoupon && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-brand-navy-dark border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-white">{t('finance.coupons.performance')}</h3>
                                <p className="text-sm text-gray-400 mt-1 font-mono">{statsCoupon.code} · {statsCoupon.name}</p>
                            </div>
                            <button onClick={() => setStatsCoupon(null)} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            {statsLoading ? (
                                <div className="h-32 flex items-center justify-center font-bold text-gray-500">{t('finance.coupons.loading_stats')}</div>
                            ) : stats ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
                                            <div className="text-3xl font-black text-white">{stats.totalRedemptions}</div>
                                            <div className="text-xs font-bold text-gray-400 mt-1">{t('finance.coupons.total_redemptions')}</div>
                                        </div>
                                        <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
                                            <div className="text-3xl font-black text-brand-gold-light">{formatPrice(stats.totalDiscount, { locale })}</div>
                                            <div className="text-xs font-bold text-gray-400 mt-1">{t('finance.coupons.total_discount')}</div>
                                        </div>
                                    </div>

                                    {stats.perCourse.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-black text-gray-300 mb-2">{t('finance.coupons.per_course')}</h4>
                                            <div className="border border-white/10 rounded-xl divide-y divide-white/5">
                                                {stats.perCourse.map((row) => (
                                                    <div key={row.courseId} className="flex items-center justify-between p-3">
                                                        <span className="text-sm text-gray-200">{pick(row, 'title')}</span>
                                                        <span className="text-sm font-bold text-gray-300">
                                                            {row.count}× · <span className="text-brand-gold-light">{formatPrice(row.discount, { locale })}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-sm font-black text-gray-300 mb-2">{t('finance.coupons.redemptions')}</h4>
                                        {stats.redemptions.length === 0 ? (
                                            <div className="text-sm text-gray-500 border border-dashed border-white/10 rounded-xl p-4 text-center">{t('finance.coupons.no_redemptions')}</div>
                                        ) : (
                                            <div className="border border-white/10 rounded-xl divide-y divide-white/5 max-h-64 overflow-y-auto">
                                                {stats.redemptions.map((r) => (
                                                    <div key={r.id} className="flex items-center justify-between p-3 gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-gray-200 truncate">{r.student?.email || t('finance.coupons.unknown')}</div>
                                                            <div className="text-xs text-gray-500 truncate">{pick(r.course, 'title')}</div>
                                                        </div>
                                                        <div className="text-right whitespace-nowrap">
                                                            <div className="text-sm font-black text-brand-gold-light">-{formatPrice(Number(r.amountOff), { locale })}</div>
                                                            <div className="text-xs text-gray-500">{new Date(r.usedAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB')}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-gray-500 text-center">{t('finance.coupons.no_data')}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
