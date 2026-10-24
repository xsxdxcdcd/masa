'use client';

import { useState } from 'react';
import { X, Users, Search, CreditCard, AlertTriangle } from 'lucide-react';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { Badge, type Tone } from '@/app/dashboard/admin/components';

type EnrollmentStatus = 'PENDING' | 'APPROVED' | 'RESERVED' | 'REJECTED' | 'REVOKED';

const ALL_STATUSES: EnrollmentStatus[] = ['APPROVED', 'RESERVED', 'PENDING', 'REJECTED', 'REVOKED'];

const ENROLLMENT_TONE: Record<EnrollmentStatus, Tone> = {
    APPROVED: 'green',
    RESERVED: 'amber',
    PENDING: 'blue',
    REJECTED: 'red',
    REVOKED: 'gray',
};

interface RosterEntry {
    id: string;
    status: EnrollmentStatus;
    createdAt: string;
    financeOfficerNotes?: string | null;
    student: { id: string; email: string };
    payment: {
        id: string;
        status: string;
        amount: string;
        method: string;
        paidAt?: string | null;
    } | null;
}

interface RosterResponse {
    opening: {
        id: string;
        status: string;
        nameAr?: string | null;
        nameEn?: string | null;
        course: { titleAr?: string | null; titleEn?: string | null };
    };
    counts: Record<EnrollmentStatus, number>;
    total: number;
    enrollments: RosterEntry[];
}

const PAYMENT_TONE: Record<string, Tone> = {
    PAID: 'green',
    PENDING: 'amber',
    REJECTED: 'red',
    REFUNDED: 'purple',
    FAILED: 'red',
    CANCELLED: 'gray',
};

const fmtNum = (n: number) => n.toLocaleString('en-US');
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

export default function OpeningRosterModal({
    openingId,
    onClose,
}: {
    openingId: string;
    onClose: () => void;
}) {
    const { t, pick } = useI18n();
    const { data, loading, error } = useFetchData<RosterResponse>(`/enrollments/opening/${openingId}`);
    // The parent keys this component by openingId, so each opening gets a fresh
    // mount and the filters below never leak from the previously viewed one.
    const [statusFilter, setStatusFilter] = useState<'ALL' | EnrollmentStatus>('ALL');
    const [query, setQuery] = useState('');

    const enrolled = data ? (statusFilter === 'ALL'
        ? data.enrollments
        : data.enrollments.filter(e => e.status === statusFilter)) : [];
    const needle = query.trim().toLowerCase();
    const visible = needle
        ? enrolled.filter(e => e.student.email.toLowerCase().includes(needle))
        : enrolled;

    // A reserved seat is money that has not arrived yet. Once the batch closes
    // this becomes the honest number: seats that were taken up for real.
    const unpaidReserved = (data?.counts?.RESERVED ?? 0) > 0 && data?.opening?.status === 'OPEN';
    const isEnded = data?.opening?.status === 'ENDED';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="bg-brand-navy border border-white/10 rounded-2xl w-full max-w-3xl shadow-xl animate-fade-in-up max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 p-6 pb-4 border-b border-white/10">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <Users size={20} className="text-brand-gold shrink-0" />
                            <span className="truncate">
                                {pick(data?.opening, 'name') || t('roster.subtitle')}
                            </span>
                        </h3>
                        {data?.opening?.course && (
                            <p className="text-sm text-gray-400 mt-1 truncate">{pick(data.opening.course, 'title')}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition cursor-pointer shrink-0"
                        aria-label={t('common.close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <p className="admin-card p-5 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                    ) : error ? (
                        <p className="p-4 text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl text-sm">{error}</p>
                    ) : (
                        <>
                            {unpaidReserved && (
                                <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-amber-300 flex items-start gap-2">
                                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                    <span>{t('admin.panel_reserved_unpaid').replace('{n}', fmtNum(data?.counts?.RESERVED ?? 0))}</span>
                                </div>
                            )}
                            {isEnded && (
                                <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300 flex items-start gap-2">
                                    <Users size={18} className="shrink-0 mt-0.5" />
                                    <span>{t('admin.roster_ended_summary').replace('{n}', fmtNum(data?.counts?.APPROVED ?? 0))}</span>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${statusFilter === 'ALL'
                                        ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black'
                                        : 'bg-white/5 text-gray-400 border border-white/10'}`}
                                >
                                    {t('admin.filter_all')} · {fmtNum(data?.total ?? 0)}
                                </button>
                                {ALL_STATUSES.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatusFilter(s)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${statusFilter === s
                                            ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black'
                                            : 'bg-white/5 text-gray-400 border border-white/10'}`}
                                    >
                                        {t(`statuses.${s.toLowerCase()}`)} · {fmtNum(data?.counts?.[s] ?? 0)}
                                    </button>
                                ))}
                            </div>

                            <div className="relative mb-4">
                                <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder={t('admin.panel_search_students')}
                                    className="ps-9 pe-3 py-2.5 w-full sm:w-72 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                                />
                            </div>

                            {visible.length === 0 ? (
                                <p className="admin-card p-5 text-sm text-gray-500 dark:text-gray-400">
                                    {(data?.total ?? 0) === 0 ? t('roster.no_students') : t('admin.panel_no_match')}
                                </p>
                            ) : (
                                <div className="admin-table-wrap">
                                    <table className="admin-table text-left">
                                        <thead>
                                            <tr>
                                                <th>{t('admin.col_email')}</th>
                                                <th>{t('roster.col_status')}</th>
                                                <th>{t('admin.panel_payment')}</th>
                                                <th>{t('roster.registered_on')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {visible.map(e => (
                                                <tr key={e.id} className="text-sm">
                                                    <td className="p-3.5 font-bold text-brand-navy dark:text-gray-200" dir="ltr">
                                                        {e.student.email}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <Badge tone={ENROLLMENT_TONE[e.status]} dot>
                                                            {t(`statuses.${e.status.toLowerCase()}`)}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3.5">
                                                        {e.payment ? (
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <Badge tone={PAYMENT_TONE[e.payment.status] ?? 'gray'} dot>
                                                                    {t(`statuses.${e.payment.status.toLowerCase()}`)}
                                                                </Badge>
                                                                <span className="font-bold text-brand-navy dark:text-gray-200">${e.payment.amount}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                                                <CreditCard size={14} /> {t('admin.panel_no_payment')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-gray-500 dark:text-gray-400">{fmtDate(e.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
