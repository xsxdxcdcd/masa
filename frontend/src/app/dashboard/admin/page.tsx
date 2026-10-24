"use client";

import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import {
    Users, BookOpen, CalendarClock, Clock, GraduationCap, Wallet, Activity, CreditCard,
    ArrowRight, Search, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader, StatCard } from './components';

interface AdminStats {
    users: { total: number; students: number; instructors: number; finance: number; courseManagers: number; admins: number };
    courses: { total: number; open: number; closed: number; totalModules: number; totalLessonsCompleted: number };
    enrollments: { total: number; pending: number; approved: number; rejected: number };
    payments: { total: number; revenue: number };
    instructorApplications: { pending: number; total: number };
    support: { total: number; open: number };
    gateways: { total: number; active: number };
    audit: { totalEvents: number };
}
interface HealthResponse { status?: string; }

export default function AdminOverviewPage() {
    const { t } = useI18n();
    const { dark } = useTheme();
    const { data: s } = useFetchData<AdminStats>('/admin/stats');
    const { data: health } = useFetchData<HealthResponse>('/health');

    const stats: { label: string; value: number; icon: LucideIcon; color: string; href: string }[] = s ? [
        { label: t('admin.stat_total_users'), value: s.users.total, icon: Users, color: 'blue', href: '/dashboard/admin/users' },
        { label: t('admin.stat_students'), value: s.users.students, icon: Users, color: 'cyan', href: '/dashboard/admin/users' },
        { label: t('admin.stat_instructors'), value: s.users.instructors, icon: GraduationCap, color: 'purple', href: '/dashboard/admin/instructors' },
        { label: t('admin.stat_total_courses'), value: s.courses.total, icon: BookOpen, color: 'indigo', href: '/dashboard/admin/courses' },
        { label: t('admin.stat_open_courses'), value: s.courses.open, icon: CalendarClock, color: 'green', href: '/dashboard/admin/openings' },
        { label: t('admin.stat_pending_reviews'), value: s.enrollments.pending, icon: Clock, color: 'orange', href: '/dashboard/admin/finance' },
        { label: t('admin.stat_pending_apps'), value: s.instructorApplications.pending, icon: GraduationCap, color: 'amber', href: '/dashboard/admin/instructors' },
        { label: t('admin.stat_gateways'), value: s.gateways.active, icon: CreditCard, color: 'teal', href: '/dashboard/admin/gateways' },
    ] : [];

    const quickLinks: { label: string; href: string; icon: LucideIcon; color: string; desc: string }[] = [
        { label: t('admin.quick_create_course'), href: '/dashboard/courses/create', icon: BookOpen, color: 'indigo', desc: t('admin.quick_desc_course') },
        { label: t('admin.quick_open_course'), href: '/dashboard/admin/courses', icon: CalendarClock, color: 'green', desc: t('admin.quick_desc_open') },
        { label: t('admin.quick_add_user'), href: '/dashboard/admin/users', icon: Users, color: 'blue', desc: t('admin.quick_desc_user') },
        { label: t('admin.quick_review_finance'), href: '/dashboard/admin/finance', icon: Wallet, color: 'orange', desc: t('admin.quick_desc_finance') },
        { label: t('admin.quick_review_apps'), href: '/dashboard/admin/instructors', icon: GraduationCap, color: 'purple', desc: t('admin.quick_desc_apps') },
        { label: t('admin.quick_gateways'), href: '/dashboard/admin/gateways', icon: CreditCard, color: 'teal', desc: t('admin.quick_desc_gateways') },
    ];

    const healthy = health?.status === 'ok';

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Hero banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy via-[#0e2a52] to-brand-navy-dark p-4 sm:p-6 lg:p-8">
                <div className="absolute -top-20 -right-16 w-72 h-72 bg-brand-gold/15 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-10 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur ${healthy ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>
                            <Activity size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">{t('admin.system_status_title')}</h2>
                                <span className={`admin-badge ${healthy ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>
                                    <span className="dot" /> {healthy ? t('admin.system_online') : t('admin.system_offline')}
                                </span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1.5 max-w-xl">{t('admin.overview_subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white/10 backdrop-blur px-5 py-3 rounded-xl">
                            <div className="text-2xl font-black text-brand-gold-light">{s?.users.total ?? 0}</div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{t('admin.stat_total_users')}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur px-5 py-3 rounded-xl">
                            <div className="text-2xl font-black text-brand-gold-light">{s?.courses.total ?? 0}</div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{t('admin.stat_total_courses')}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur px-5 py-3 rounded-xl">
                            <div className="text-2xl font-black text-brand-gold-light">{s?.enrollments.pending ?? 0}</div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{t('admin.stat_pending_reviews')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Page header */}
            <PageHeader title={t('admin.statistics_title')} subtitle={t('admin.statistics_subtitle')} />

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in-up">
                {stats.map((s) => (
                    <StatCard key={s.label} icon={s.icon} color={s.color} value={s.value} label={s.label} href={s.href} />
                ))}
            </div>

            {/* Quick actions */}
            <section>
                <PageHeader title={t('admin.quick_actions')} subtitle={t('admin.quick_actions_subtitle')} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                    {quickLinks.map((q) => {
                        const Icon = q.icon;
                        return (
                            <Link key={q.label} href={q.href}>
                                <div className="admin-card p-5 flex items-center gap-4 group animate-fade-in-up">
                                    <div className={`admin-tile w-12 h-12 shrink-0 ${{
                                        indigo: 'bg-brand-navy-light/15 text-indigo-400',
                                        green: 'bg-emerald-500/15 text-emerald-400',
                                        blue: 'bg-brand-navy-light/15 text-brand-navy-light',
                                        orange: 'bg-orange-500/15 text-orange-400',
                                        purple: 'bg-purple-500/15 text-purple-400',
                                        teal: 'bg-teal-500/15 text-teal-400',
                                    }[q.color]}`}>
                                        <Icon size={22} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-black text-brand-navy dark:text-white">{q.label}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">{q.desc}</div>
                                    </div>
                                    <ArrowRight size={18} className="text-gray-500 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <Link href="/dashboard/admin/audit" className="block">
                <div className="admin-card p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="admin-tile w-12 h-12 bg-red-500/10 text-red-400">
                            <Search size={22} />
                        </div>
                        <div>
                            <div className="font-black text-brand-navy dark:text-white">{t('admin.audit_logs_title')}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">{t('admin.audit_logs_desc')}</div>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-2 text-brand-navy dark:text-white font-bold text-sm">
                        {t('admin.view_audit')} <ArrowRight size={16} className="rtl:rotate-180" />
                    </span>
                </div>
            </Link>

            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-bold">
                <img
                    src={dark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png'}
                    alt="Laxalab Academy"
                    className="h-5 w-auto max-w-[45vw] object-contain"
                />
                <span className="opacity-70">{t('admin.console_label')}</span>
            </div>
        </div>
    );
}
