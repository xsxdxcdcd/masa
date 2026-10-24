"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { formatPrice, formatDate } from '@/lib/format';
import { ArrowLeft, Trophy, Flame, Star, User, BookOpen, CreditCard } from 'lucide-react';
import { PageHeader, Badge, EmptyState, type Tone } from '../../components';

interface UserDetail {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
}

interface Enrollment {
    id: string;
    status: string;
    createdAt: string;
    course?: { titleAr?: string | null; titleEn?: string | null } | null;
    opening?: { price: string | number } | null;
}

interface Payment {
    id: string;
    amount: number | string;
    status: string;
    createdAt: string;
}

interface BadgeData {
    type: string;
    nameAr?: string | null;
    nameEn?: string | null;
    threshold: number;
    earned: boolean;
}

interface GamificationData {
    points?: number;
    level?: number;
    streak?: number;
    allBadges?: BadgeData[];
}

const roleTone: Record<string, Tone> = {
    ADMIN: 'red',
    FINANCE: 'green',
    INSTRUCTOR: 'purple',
    COURSE_MANAGER: 'amber',
    STUDENT: 'blue',
};

const statusTone: Record<string, Tone> = {
    PENDING: 'amber',
    APPROVED: 'green',
    REJECTED: 'red',
    RESERVED: 'blue',
};

export default function AdminUserDetailPage() {
    const { id } = useParams();
    const { t, locale, pick } = useI18n();

    const { data: user, loading, error } = useFetchData<UserDetail>(`/users/${id}`);
    const { data: enrollments, loading: enrollmentsLoading } = useFetchData<Enrollment[]>(`/enrollments/all?studentId=${id}`);
    const { data: payments, loading: paymentsLoading } = useFetchData<Payment[]>(`/payments?userId=${id}`);
    const { data: gamification } = useFetchData<GamificationData>(`/gamification/${id}`);

    const meta = (user?.metadata ?? {}) as Record<string, unknown>;
    const roleLabel = (role: string) => t('roles.' + (role || '').toLowerCase()) || role;
    const statusLabel = (status: string) => t('statuses.' + (status || '').toLowerCase()) || status;

    const points = Number(gamification?.points ?? 0);
    const level = Math.max(1, Number(gamification?.level ?? 1));
    const streak = Number(gamification?.streak ?? 0);
    const badges = (gamification?.allBadges || []).filter(b => b.earned);

    const infoRows: { label: string; value: ReactNode }[] = [
        { label: t('profile.email'), value: <span className="text-brand-navy dark:text-gray-200">{user?.email || '—'}</span> },
        { label: t('profile.role'), value: user ? <Badge tone={roleTone[user.role] || 'gray'} dot={false}>{roleLabel(user.role)}</Badge> : '—' },
        { label: t('profile.member_since'), value: formatDate(user?.createdAt, { locale }) || '—' },
        { label: t('profile.phone'), value: (meta.phone as string) || '—' },
        { label: t('profile.city'), value: (meta.city as string) || '—' },
        { label: t('profile.specialty'), value: (meta.specialty as string) || '—' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Back */}
            <Link
                href="/dashboard/admin/users"
                className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white hover:border-brand-navy/20 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-[#1a2d4a] transition"
            >
                <ArrowLeft size={16} className="rtl:rotate-180" /> {t('common.back')}
            </Link>

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-60 bg-white dark:bg-brand-navy-dark flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 rounded-2xl border border-gray-200 dark:border-white/5">
                    {t('common.loading')}
                </div>
            ) : (
                <>
                    <PageHeader
                        title={user?.email || id as string}
                        subtitle={t('admin.users_heading')}
                        actions={
                            user && (
                                <div className="flex items-center gap-2">
                                    <Badge tone={roleTone[user.role] || 'gray'} dot={false}>{roleLabel(user.role)}</Badge>
                                    <Badge tone={user.isActive === false ? 'red' : 'green'} dot>
                                        {user.isActive === false ? t('admin.status_suspended') : t('admin.status_active')}
                                    </Badge>
                                </div>
                            )
                        }
                    />

                    {/* User info card */}
                    <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-6 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/15 dark:text-brand-navy-light flex items-center justify-center">
                                <User size={20} />
                            </div>
                            <h3 className="font-black text-brand-navy dark:text-white">{t('profile.personal_info')}</h3>
                        </div>
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            {infoRows.map(row => (
                                <div key={row.label}>
                                    <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-1">{row.label}</p>
                                    <div className="text-sm font-bold text-brand-navy dark:text-gray-200">{row.value}</div>
                                </div>
                            ))}
                            <div className="sm:col-span-2 lg:col-span-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-1">{t('profile.bio')}</p>
                                <p className="text-sm font-bold text-brand-navy dark:text-gray-200 leading-relaxed">{(meta.bio as string) || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Gamification stats */}
                    {gamification && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up">
                            <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold-light flex items-center justify-center shrink-0">
                                    <Star size={22} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-brand-navy dark:text-white tabular-nums">{points}</div>
                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">{t('gamification.xp')}</div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <Trophy size={22} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-brand-navy dark:text-white tabular-nums">{level}</div>
                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">{t('gamification.level')}</div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${streak > 0 ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
                                    <Flame size={22} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-brand-navy dark:text-white tabular-nums">{streak}</div>
                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">{t('gamification.streak')}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Badges grid */}
                    {badges.length > 0 && (
                        <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-6 animate-fade-in-up">
                            <h3 className="font-black text-brand-navy dark:text-white mb-4">{t('gamification.badges')}</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {badges.map(b => (
                                    <div
                                        key={b.type}
                                        title={pick(b, 'name') || b.type}
                                        className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3 flex flex-col items-center gap-1.5 text-center"
                                    >
                                        <Trophy size={20} className="text-brand-gold-dark dark:text-brand-gold-light" />
                                        <span className="text-[10px] font-bold text-brand-navy dark:text-gray-200 leading-tight break-all">{pick(b, 'name') || b.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enrollments table */}
                    <div className="admin-table-wrap animate-fade-in-up">
                        <table className="admin-table text-left">
                            <thead>
                                <tr>
                                    <th>{t('admin.col_course')}</th>
                                    <th>{t('admin.col_status')}</th>
                                    <th>{t('common.price')}</th>
                                    <th>{t('common.date')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                {(enrollments || []).map(e => (
                                    <tr key={e.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                        <td className="p-4 font-bold text-brand-navy dark:text-gray-200">{pick(e.course, 'title') || '—'}</td>
                                        <td className="p-4">
                                            <Badge tone={statusTone[e.status] || 'gray'} dot>{statusLabel(e.status)}</Badge>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">{e.opening ? formatPrice(e.opening.price, { locale }) : '—'}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(e.createdAt, { locale })}</td>
                                    </tr>
                                ))}
                                {!enrollmentsLoading && (enrollments || []).length === 0 && (
                                    <EmptyState icon={BookOpen} title={t('gamification.no_data')} />
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Payments table */}
                    <div className="admin-table-wrap animate-fade-in-up">
                        <table className="admin-table text-left">
                            <thead>
                                <tr>
                                    <th>{t('finance.col_amount')}</th>
                                    <th>{t('admin.col_status')}</th>
                                    <th>{t('common.date')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                {(payments || []).map(p => (
                                    <tr key={p.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                        <td className="p-4 font-bold text-brand-navy dark:text-gray-200">{formatPrice(p.amount, { locale })}</td>
                                        <td className="p-4">
                                            <Badge tone={statusTone[p.status] || 'gray'} dot>{statusLabel(p.status)}</Badge>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(p.createdAt, { locale })}</td>
                                    </tr>
                                ))}
                                {!paymentsLoading && (payments || []).length === 0 && (
                                    <EmptyState icon={CreditCard} title={t('gamification.no_data')} />
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
