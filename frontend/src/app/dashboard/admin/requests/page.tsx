"use client";

import { useState } from 'react';
import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import {
    CalendarPlus, Flag, Lightbulb, Check, X, Trash2, Loader,
} from 'lucide-react';
import { PageHeader, Badge, EmptyPanel, type Tone } from '../components';

interface InstructorRef { id: string; email: string; }
interface CourseRef { id: string; titleAr?: string | null; titleEn?: string | null; }
interface OpeningRef { id: string; nameAr?: string | null; nameEn?: string | null; status?: string; course?: CourseRef; }

interface OpeningReqRow {
    id: string;
    status: string;
    reason?: string | null;
    createdAt: string;
    course: CourseRef;
    instructor: InstructorRef;
}

interface CloseReqRow {
    id: string;
    status: string;
    reason?: string | null;
    createdAt: string;
    opening: OpeningRef;
    instructor: InstructorRef;
}

interface SuggestionRow {
    id: string;
    status: string;
    titleAr: string;
    titleEn: string;
    categoryAr?: string | null;
    categoryEn?: string | null;
    description?: string | null;
    reviewNotes?: string | null;
    createdAt: string;
    instructor: InstructorRef;
}

type Tab = 'openings' | 'closures' | 'suggestions';

const statusTone: Record<string, Tone> = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' };
const statusKey: Record<string, string> = { PENDING: 'statuses.pending', APPROVED: 'statuses.approved', REJECTED: 'statuses.rejected' };
const openingKey: Record<string, string> = {
    DRAFT: 'manageCourses.status_draft', ANNOUNCEMENT: 'manageCourses.status_announcement', OPEN: 'manageCourses.status_open',
    STARTED: 'manageCourses.status_started', ENDED: 'manageCourses.status_ended',
};

export default function AdminRequestsPage() {
    const { t, pick } = useI18n();
    const [tab, setTab] = useState<Tab>('openings');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data: openingReqs, loading: loadingOpenings, refetch: refetchOpenings } = useFetchData<OpeningReqRow[]>('/instructor-requests/openings');
    const { data: closeReqs, loading: loadingClosures, refetch: refetchClosures } = useFetchData<CloseReqRow[]>('/instructor-requests/closures');
    const { data: suggestions, loading: loadingSuggestions, refetch: refetchSuggestions } = useFetchData<SuggestionRow[]>('/instructor-requests/suggestions');

    const review = async (kind: 'openings' | 'closures' | 'suggestions', id: string, status: 'APPROVED' | 'REJECTED') => {
        if (!window.confirm(t(status === 'APPROVED' ? 'adminRequests.approve_confirm' : 'adminRequests.reject_confirm'))) return;
        setProcessingId(id);
        try {
            await api.patch(`/instructor-requests/${kind === 'openings' ? 'openings' : kind === 'closures' ? 'closures' : 'suggestions'}/${id}/status`, { status });
            toast.success(t('adminRequests.action_success'));
            if (kind === 'openings') refetchOpenings();
            if (kind === 'closures') refetchClosures();
            if (kind === 'suggestions') refetchSuggestions();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('adminRequests.action_fail'));
        }
        setProcessingId(null);
    };

    const remove = async (kind: Tab, id: string) => {
        if (!window.confirm(t('adminRequests.delete_confirm'))) return;
        setProcessingId(id);
        try {
            await api.delete(`/instructor-requests/${kind === 'openings' ? 'openings' : kind === 'closures' ? 'closures' : 'suggestions'}/${id}`);
            toast.success(t('adminRequests.deleted'));
            if (kind === 'openings') refetchOpenings();
            if (kind === 'closures') refetchClosures();
            if (kind === 'suggestions') refetchSuggestions();
        } catch {
            toast.error(t('adminRequests.action_fail'));
        }
        setProcessingId(null);
    };

    const actionBtns = (kind: Tab, row: { id: string; status: string }) => {
        if (row.status !== 'PENDING') {
            return (
                <button onClick={() => remove(kind, row.id)} disabled={processingId === row.id}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg disabled:opacity-40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer tooltip" title={t('common.delete')}>
                    <Trash2 size={18} />
                </button>
            );
        }
        return (
            <div className="inline-flex items-center gap-1.5">
                <button onClick={() => review(kind, row.id, 'APPROVED')} disabled={processingId === row.id}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg disabled:opacity-40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition cursor-pointer tooltip" title={t('adminRequests.approve')}>
                    {processingId === row.id ? <Loader size={18} className="animate-spin" /> : <Check size={18} />}
                </button>
                <button onClick={() => review(kind, row.id, 'REJECTED')} disabled={processingId === row.id}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg disabled:opacity-40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer tooltip" title={t('adminRequests.reject')}>
                    <X size={18} />
                </button>
                <button onClick={() => remove(kind, row.id)} disabled={processingId === row.id}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg disabled:opacity-40 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer tooltip" title={t('common.delete')}>
                    <Trash2 size={18} />
                </button>
            </div>
        );
    };

    const tabBtn = (key: Tab, icon: React.ReactNode, label: string, count: number) => (
        <button onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                tab === key ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black shadow-md shadow-brand-gold/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}>
            {icon} {label}
            {count > 0 && (
                <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black inline-flex items-center justify-center ${tab === key ? 'bg-black/20 text-black' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
                    {count}
                </span>
            )}
        </button>
    );

    const pendingCount = (rows: { status: string }[] | null) => (rows || []).filter((r) => r.status === 'PENDING').length;

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('adminRequests.heading')}
                subtitle={t('adminRequests.subtitle')}
            />

            <div className="inline-flex flex-wrap items-center gap-1 bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-1">
                {tabBtn('openings', <CalendarPlus size={16} />, t('adminRequests.tab_openings'), pendingCount(openingReqs))}
                {tabBtn('closures', <Flag size={16} />, t('adminRequests.tab_closures'), pendingCount(closeReqs))}
                {tabBtn('suggestions', <Lightbulb size={16} />, t('adminRequests.tab_suggestions'), pendingCount(suggestions))}
            </div>

            {tab === 'openings' && (
                <div className="bg-white dark:bg-brand-navy-dark rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
                    {loadingOpenings ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400"><Loader className="animate-spin me-2" size={20} /> {t('common.loading')}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/5">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_course')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_instructor')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_reason')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_requested')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_status')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                    {(openingReqs || []).map((r) => (
                                        <tr key={r.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5 transition">
                                            <td className="p-4 font-bold text-brand-navy dark:text-white">{pick(r.course, 'title')}</td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{r.instructor.email}</td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-[280px]">{r.reason || '—'}</td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                                            <td className="p-4"><Badge tone={statusTone[r.status] ?? 'gray'}>{t(statusKey[r.status] ?? '')}</Badge></td>
                                            <td className="p-4 text-right whitespace-nowrap">{actionBtns('openings', r)}</td>
                                        </tr>
                                    ))}
                                    {(openingReqs || []).length === 0 && <EmptyPanel icon={CalendarPlus} title={t('adminRequests.empty_openings')} />}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {tab === 'closures' && (
                <div className="bg-white dark:bg-brand-navy-dark rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
                    {loadingClosures ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400"><Loader className="animate-spin me-2" size={20} /> {t('common.loading')}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/5">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_opening')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_instructor')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_reason')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_requested')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_status')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                    {(closeReqs || []).map((r) => (
                                        <tr key={r.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5 transition">
                                            <td className="p-4">
                                                <p className="font-bold text-brand-navy dark:text-white">{pick(r.opening, 'name') || t('manageCourses.opening_default')}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                                                    {r.opening.course ? pick(r.opening.course, 'title') : ''}
                                                    {r.opening.status ? ` · ${t(openingKey[r.opening.status] ?? '')}` : ''}
                                                </p>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{r.instructor.email}</td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-[280px]">{r.reason || '—'}</td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                                            <td className="p-4"><Badge tone={statusTone[r.status] ?? 'gray'}>{t(statusKey[r.status] ?? '')}</Badge></td>
                                            <td className="p-4 text-right whitespace-nowrap">{actionBtns('closures', r)}</td>
                                        </tr>
                                    ))}
                                    {(closeReqs || []).length === 0 && <EmptyPanel icon={Flag} title={t('adminRequests.empty_closures')} />}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {tab === 'suggestions' && (
                <div className="bg-white dark:bg-brand-navy-dark rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
                    {loadingSuggestions ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400"><Loader className="animate-spin me-2" size={20} /> {t('common.loading')}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/5">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_title')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_instructor')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_reason')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_requested')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('adminRequests.col_status')}</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                    {(suggestions || []).map((r) => (
                                        <tr key={r.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5 transition">
                                            <td className="p-4">
                                                <p className="font-bold text-brand-navy dark:text-white">{pick(r, 'title')}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{pick(r, 'category') || '—'}</p>
                                                {r.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[220px] truncate">{r.description}</p>}
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{r.instructor.email}</td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-[220px]">{r.reviewNotes || '—'}</td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                                            <td className="p-4"><Badge tone={statusTone[r.status] ?? 'gray'}>{t(statusKey[r.status] ?? '')}</Badge></td>
                                            <td className="p-4 text-right whitespace-nowrap">{actionBtns('suggestions', r)}</td>
                                        </tr>
                                    ))}
                                    {(suggestions || []).length === 0 && <EmptyPanel icon={Lightbulb} title={t('adminRequests.empty_suggestions')} />}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
