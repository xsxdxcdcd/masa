"use client";

import { useMemo, useState } from 'react';
import { BookOpen, CalendarClock, Flag, FileText, Search, Users } from 'lucide-react';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { PageHeader, StatCard, Badge, EmptyState } from '../components';
import EndedOpeningReportModal from '@/components/admin/EndedOpeningReportModal';

interface Opening {
    id: string;
    status?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    price?: string | null;
    courseId: string;
    instructor?: { email: string } | null;
    _count?: { enrollments?: number };
}

interface Course {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    openings?: Opening[];
}

const formatDate = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function AdminEndedPage() {
    const { t, pick } = useI18n();
    const [query, setQuery] = useState('');
    const [report, setReport] = useState<{ openingId: string; courseId: string } | null>(null);
    const { data: courses, loading } = useFetchData<Course[]>('/courses?includeUnpublished=true');

    // A finished batch is the archival unit: it keeps its own roster and its own
    // certificate set, so the wrap-up report is keyed by opening, not by course.
    const ended = useMemo<(Opening & { course: Course })[]>(
        () => (courses || [])
            .flatMap(c => (c.openings || []).map(o => ({ ...o, course: c })))
            .filter(o => o.status === 'ENDED')
            .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || '')),
        [courses],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ended;
        return ended.filter(o => {
            const courseTitle = pick(o.course, 'title') || '';
            return [courseTitle, o.nameAr, o.nameEn, o.instructor?.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q);
        });
    }, [ended, query, pick]);

    const totalStudents = ended.reduce((sum, o) => sum + (o._count?.enrollments ?? 0), 0);
    const courseCount = new Set(ended.map(o => o.courseId)).size;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('endedCourses.title')}
                subtitle={t('endedCourses.subtitle')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={Flag}
                    color="navy"
                    value={ended.length}
                    label={t('endedCourses.stat_batches')}
                />
                <StatCard
                    icon={BookOpen}
                    color="purple"
                    value={courseCount}
                    label={t('endedCourses.stat_courses')}
                />
                <StatCard
                    icon={Users}
                    color="green"
                    value={totalStudents}
                    label={t('endedCourses.stat_students')}
                />
            </div>

            <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-white/5">
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-gray-400 pointer-events-none" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('endedCourses.search_placeholder')}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 ltr:pl-9 rtl:pr-9 text-sm font-bold text-brand-navy dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand-gold/50"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-500 dark:text-gray-400 text-xs font-black border-b border-gray-100 dark:border-white/5">
                                <th className="text-start px-5 py-3">{t('endedCourses.col_course')}</th>
                                <th className="text-start px-5 py-3">{t('endedCourses.col_opening')}</th>
                                <th className="text-start px-5 py-3">{t('endedCourses.col_period')}</th>
                                <th className="text-start px-5 py-3">{t('endedCourses.col_students')}</th>
                                <th className="text-start px-5 py-3">{t('common.status')}</th>
                                <th className="text-start px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400 font-bold text-sm">
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <EmptyState icon={CalendarClock} title={t('endedCourses.empty')} />
                            ) : (
                                filtered.map(o => {
                                    const courseTitle = pick(o.course, 'title') || t('endedCourses.untitled');
                                    const start = formatDate(o.startDate);
                                    const end = formatDate(o.endDate);
                                    return (
                                        <tr key={o.id} className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="font-black text-brand-navy dark:text-white">{courseTitle}</div>
                                                {o.instructor?.email && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5" dir="ltr">
                                                        {o.instructor.email}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-gray-600 dark:text-gray-300 font-bold">
                                                {pick(o, 'name') || t('endedCourses.col_opening')}
                                            </td>
                                            <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs font-bold whitespace-nowrap">
                                                {start && end ? `${start} — ${end}` : (end || start || t('endedCourses.not_set'))}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-1.5 font-black text-brand-navy dark:text-white">
                                                    <Users size={14} className="text-brand-gold" />
                                                    {o._count?.enrollments ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <Badge tone="gray">{t('manageCourses.status_ended')}</Badge>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button
                                                    onClick={() => setReport({ openingId: o.id, courseId: o.courseId })}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold-light text-xs font-black transition-colors"
                                                >
                                                    <FileText size={14} />
                                                    {t('endedCourses.view_report')}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {report && (
                <EndedOpeningReportModal
                    openingId={report.openingId}
                    courseId={report.courseId}
                    onClose={() => setReport(null)}
                />
            )}
        </div>
    );
}
