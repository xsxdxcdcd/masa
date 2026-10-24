"use client";

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { Loader, LifeBuoy, Save } from 'lucide-react';
import { PageHeader, EmptyState } from '../components';

interface Ticket {
    id: string;
    subject: string;
    message: string;
    status: string;
    adminNotes?: string | null;
    createdAt: string;
    user: { id: string; email: string };
}

type StatusFilter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export default function AdminTicketsPage() {
    const { t } = useI18n();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [replies, setReplies] = useState<Record<string, string>>({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

    const counts: Record<StatusFilter, number> = {
        ALL: tickets.length,
        OPEN: tickets.filter((tk) => tk.status === 'OPEN').length,
        IN_PROGRESS: tickets.filter((tk) => tk.status === 'IN_PROGRESS').length,
        CLOSED: tickets.filter((tk) => tk.status === 'CLOSED').length,
    };

    const filtered = tickets.filter((tk) => statusFilter === 'ALL' || tk.status === statusFilter);

    const statBtn = (s: StatusFilter) => (
        <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl p-3 text-start transition-all duration-200 ${statusFilter === s
                ? 'bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white shadow-lg shadow-black/25 scale-[1.02] border border-white/10'
                : 'bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 hover:shadow-md'
                }`}
        >
            <div className="admin-stat-value">{counts[s]}</div>
            <div className={`text-[11px] font-black mt-1 ${statusFilter === s ? 'text-brand-gold-light' : 'text-gray-500 dark:text-gray-400'}`}>
                {s === 'ALL' ? t('admin.filter_all') : t('statuses.' + s.toLowerCase())}
            </div>
        </button>
    );

    useEffect(() => {
        let active = true;
        const run = async () => {
            try {
                const res = await api.get('/api/admin/support-tickets');
                if (active) setTickets(res.data);
            } catch (err) {
                if (active) toast.error(getErrorMessage(err) || t('support.submit_fail'));
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => { active = false; };
    }, [refreshKey, t]);

    const changeStatus = async (id: string, status: string) => {
        setProcessing(id);
        try {
            await api.patch(`/api/admin/support-tickets/${id}`, { status });
            toast.success(t('support.status_updated'));
            setRefreshKey((k) => k + 1);
        } catch {
            toast.error(t('support.status_fail'));
        }
        setProcessing(null);
    };

    const saveReply = async (id: string) => {
        setProcessing(id);
        try {
            await api.patch(`/api/admin/support-tickets/${id}`, { adminNotes: replies[id]?.trim() ?? '' });
            toast.success(t('support.reply_saved'));
            setRefreshKey((k) => k + 1);
        } catch {
            toast.error(t('support.reply_fail'));
        }
        setProcessing(null);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader title={t('admin.nav_tickets')} subtitle={t('support.subtitle')} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
                {(['ALL', 'OPEN', 'IN_PROGRESS', 'CLOSED'] as const).map((s) => statBtn(s))}
            </div>

            {loading ? (
                <div className="h-40 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold"><Loader className="animate-spin" size={32} /></div>
            ) : (
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl overflow-x-auto animate-fade-in-up">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-white/5">
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('support.col_ticket')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('support.col_user')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('support.col_status')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('support.col_date')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('support.admin_response')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {filtered.map((tk) => (
                                <tr key={tk.id} className="align-top animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                    <td className="p-4 max-w-[280px]">
                                        <p className="font-bold text-brand-navy dark:text-white">{tk.subject}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words mt-1">{tk.message}</p>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{tk.user.email}</td>
                                    <td className="p-4">
                                        <select
                                            value={tk.status}
                                            onChange={(e) => changeStatus(tk.id, e.target.value)}
                                            disabled={processing === tk.id}
                                            className="px-2 py-1.5 border border-gray-300 dark:border-white/10 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-gold outline-none bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white"
                                        >
                                            <option value="OPEN">{t('support.status_open')}</option>
                                            <option value="IN_PROGRESS">{t('support.status_in_progress')}</option>
                                            <option value="CLOSED">{t('support.status_closed')}</option>
                                        </select>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(tk.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 min-w-[260px]">
                                        <textarea
                                            rows={2}
                                            value={replies[tk.id] ?? tk.adminNotes ?? ''}
                                            onChange={(e) => setReplies((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                                            placeholder={t('support.reply_placeholder')}
                                            className="w-full px-3 py-2 bg-white dark:bg-brand-navy-dark border border-gray-300 dark:border-white/10 rounded-xl text-sm text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition resize-none"
                                        />
                                        <button
                                            onClick={() => saveReply(tk.id)}
                                            disabled={processing === tk.id || (replies[tk.id] ?? tk.adminNotes ?? '') === ''}
                                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy dark:text-white bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 px-3 py-1.5 rounded-lg transition disabled:opacity-40 cursor-pointer"
                                        >
                                            <Save size={13} /> {t('support.save_reply')}
                                        </button>
                                        {tk.adminNotes && (
                                            <div className="mt-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2">
                                                <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mb-0.5">{t('support.admin_response')}</p>
                                                <p className="text-xs text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap break-words">{tk.adminNotes}</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <EmptyState icon={LifeBuoy} title={t('support.no_tickets')} />}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
