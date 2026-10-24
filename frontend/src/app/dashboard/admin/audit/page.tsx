"use client";

import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import { ShieldAlert, Activity, RefreshCw, Search } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnSoft } from '../components';

interface AuditLog {
    id: string;
    timestamp: string;
    action: string;
    ipAddress?: string | null;
    user?: { email: string; role: string } | null;
}

export default function AdminAuditPage() {
    const { t } = useI18n();
    const [limit, setLimit] = useState(50);
    const [actionSearch, setActionSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const { data: logs, loading, error, refetch } = useFetchData<AuditLog[]>(`/api/admin/audit?limit=${limit}`);

    const filtered = logs?.filter(log =>
        log.action.toLowerCase().includes(actionSearch.toLowerCase()) &&
        (log.user?.email ?? '').toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('audit.heading')}
                subtitle={t('audit.subtitle')}
                actions={
                    <>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                            <input
                                value={actionSearch}
                                onChange={e => setActionSearch(e.target.value)}
                                placeholder={t('audit.search_action')}
                                className="ps-9 pe-3 py-2 border border-gray-300 dark:border-white/10 rounded-xl text-sm w-44 bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                            />
                        </div>
                        <input
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            placeholder={t('audit.search_user')}
                            className="px-3.5 py-2 border border-gray-300 dark:border-white/10 rounded-xl text-sm w-48 bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                        />
                        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="px-3.5 py-2 border border-gray-300 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-gold font-bold">
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <BtnSoft icon={RefreshCw} onClick={refetch}>{t('admin.refresh')}</BtnSoft>
                    </>
                }
            />

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400 animate-pulse">
                    <Activity size={52} className="mx-auto mb-4" />
                    <p className="font-bold">{t('audit.loading')}</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl overflow-x-auto animate-fade-in-up">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-white/5">
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('audit.col_timestamp')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('audit.col_action')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('audit.col_user')}</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">{t('audit.col_ip')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {filtered?.map((log) => (
                                <tr key={log.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5 transition">
                                    <td className="p-4 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-4 text-brand-navy dark:text-white font-bold">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold-dark dark:bg-brand-gold-light shrink-0" />
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {log.user ? (
                                            <div>
                                                <span className="font-bold text-brand-navy dark:text-white">{log.user.email}</span>
                                                <Badge tone="gray" dot={false}><span className="ms-1">{t('roles.' + (log.user.role || '').toLowerCase())}</span></Badge>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 dark:text-gray-400 italic">{t('audit.system_unknown')}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center cursor-help text-xs" title={t('audit.ip_title')}>
                                        <span className="bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-lg inline-block font-mono font-bold text-gray-600 dark:text-gray-300">
                                            {log.ipAddress || t('audit.na')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filtered?.length === 0 && (
                                <EmptyState icon={ShieldAlert} title={t('audit.no_logs')} />
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
