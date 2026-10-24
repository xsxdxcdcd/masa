"use client";

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import RosterGrades from '@/components/RosterGrades';
import TasksPanel from '@/components/TasksPanel';
import CourseChat from '@/components/CourseChat';
import LessonExplorer from '@/components/LessonExplorer';
import InstructorAnnouncements from '@/components/InstructorAnnouncements';
import AcademicCalendar from '@/components/AcademicCalendar';
import LiveSessionManager from '@/components/LiveSessionManager';
import { Settings2, ClipboardList, MessagesSquare, BarChart3, Flag, Users, BookOpen, Hash, ArrowLeft, Megaphone, Calendar, Video } from 'lucide-react';

interface MyOpening {
    id: string;
    nameAr?: string | null;
    nameEn?: string | null;
    status: string;
    course: { id: string; titleAr?: string | null; titleEn?: string | null; contentType?: string | null };
}

interface RosterData {
    enrollments: { id: string }[];
}

interface TaskData {
    id: string;
}

interface ModuleData {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    videoUrl?: string | null;
    durationMinutes?: number | null;
    outcomes?: { descriptionAr?: string | null; descriptionEn?: string | null }[];
    files?: { url: string; nameAr?: string | null; nameEn?: string | null }[] | null;
    links?: { url: string; labelAr?: string | null; labelEn?: string | null }[] | null;
}

interface SyllabusData {
    chapters?: { titleAr?: string | null; titleEn?: string | null; modules?: ModuleData[] | null }[] | null;
}

type Tab = 'roster' | 'tasks' | 'announcements' | 'calendar' | 'sessions' | 'content' | 'chat' | 'analytics';

const VALID_TABS: Tab[] = ['roster', 'tasks', 'announcements', 'calendar', 'sessions', 'content', 'chat', 'analytics'];

const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
    ANNOUNCEMENT: 'bg-brand-navy-light/10 text-brand-navy-light border border-brand-navy-light/20',
    OPEN: 'bg-green-500/10 text-green-400 border border-green-500/20',
    STARTED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    ENDED: 'bg-gray-500/10 text-gray-500 border border-gray-500/20',
};
const statusLabelsAr: Record<string, string> = {
    DRAFT: 'مسودة', ANNOUNCEMENT: 'إعلان', OPEN: 'مفتوح', STARTED: 'قيد التنفيذ', ENDED: 'منتهي',
};
const statusLabelsEn: Record<string, string> = {
    DRAFT: 'Draft', ANNOUNCEMENT: 'Announcement', OPEN: 'Open', STARTED: 'Started', ENDED: 'Ended',
};

export default function TeachingWorkspacePage() {
    const { openingId } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t, pick, locale } = useI18n();
    const isAr = locale === 'ar';

    const urlTab = searchParams?.get('tab') as Tab | null;
    const [lastTab, setLastTab] = useState<Tab>(urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'roster');
    const requestedTab: Tab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : lastTab;

    const setTab = (key: Tab) => {
        setLastTab(key);
        router.push(`/dashboard/teaching/${openingId}?tab=${key}`, { scroll: false });
    };

    const { data: openings } = useFetchData<MyOpening[]>('/openings/mine');
    const { data: rosterData } = useFetchData<RosterData>(`/openings/${openingId}/roster`);
    const { data: tasksData } = useFetchData<TaskData[]>(`/tasks/opening/${openingId}`);
    const { data: modulesData } = useFetchData<ModuleData[]>(`/openings/${openingId}/modules`);

    const opening = (openings || []).find((o) => o.id === openingId);
    // A recorded course has no meeting schedule to manage: the tab is hidden, and
    // a direct ?tab=sessions link must not resurrect what the button cannot open.
    const isRecorded = opening?.course.contentType === 'RECORDED';
    const tab: Tab = isRecorded && requestedTab === 'sessions' ? 'roster' : requestedTab;

    const { data: syllabusData } = useFetchData<SyllabusData>(opening ? `/lms/courses/${opening.course.id}/syllabus` : null);

    const studentCount = rosterData?.enrollments?.length;
    const taskCount = Array.isArray(tasksData) ? tasksData.length : null;
    const statusLabel = opening
        ? ((isAr ? statusLabelsAr[opening.status] : statusLabelsEn[opening.status]) ?? opening.status)
        : null;

    const statusBadge = (status: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColors[status] || statusColors.DRAFT}`}>
            {isAr ? (statusLabelsAr[status] ?? status) : (statusLabelsEn[status] ?? status)}
        </span>
    );

    const tabBtn = (key: Tab, icon: React.ReactNode, label: string) => (
        <button
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                tab === key
                    ? 'bg-brand-gold/10 text-brand-gold-light border border-brand-gold/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    const statPill = (icon: React.ReactNode, value: string | number | null | undefined, label: string) => (
        <div className="inline-flex items-center gap-3 bg-brand-navy-dark border border-white/5 rounded-xl px-4 py-2.5">
            <div className="text-brand-gold-light">{icon}</div>
            <div>
                <p className="text-white font-black text-sm leading-tight">{value ?? '—'}</p>
                <p className="text-gray-400 text-xs">{label}</p>
            </div>
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={['INSTRUCTOR']}>
            <div className="bg-gray-50 dark:bg-brand-navy-dark animate-fade-in space-y-6 p-4 lg:p-8">
                <Link
                    href="/dashboard/teaching"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white transition mb-2"
                >
                    <ArrowLeft size={16} /> {isAr ? 'العودة لمركز التدريس' : 'Back to Teaching Hub'}
                </Link>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-2xl font-black text-white tracking-tight">
                                {pick(opening, 'name') || t('manageCourses.opening_default')}
                            </h2>
                            {opening && statusBadge(opening.status)}
                        </div>
                        <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-1.5">
                            <BookOpen size={13} className="text-gray-500" />
                            {opening ? pick(opening.course, 'title') : '...'}
                        </p>
                    </div>
                    <a
                        href={`/dashboard/teaching?close=${openingId}`}
                        className="inline-flex items-center gap-2 text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition"
                    >
                        <Flag size={15} /> {t('teaching.request_close_btn')}
                    </a>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {statPill(<Users size={16} />, studentCount, isAr ? 'طالب' : 'Students')}
                    {statPill(<ClipboardList size={16} />, taskCount, isAr ? 'مهمة' : 'Tasks')}
                    {statPill(<Hash size={16} />, statusLabel, isAr ? 'الحالة' : 'Status')}
                </div>

                <div className="inline-flex items-center gap-1 bg-brand-navy-dark border border-white/5 rounded-2xl p-1.5 overflow-x-auto max-w-full">
                    {tabBtn('roster', <Settings2 size={16} />, isAr ? 'الطلاب والدرجات' : 'Roster')}
                    {tabBtn('tasks', <ClipboardList size={16} />, t('tasks.tasks_title'))}
                    {tabBtn('announcements', <Megaphone size={16} />, isAr ? 'الإعلانات' : 'Announcements')}
                    {tabBtn('calendar', <Calendar size={16} />, isAr ? 'التقويم' : 'Calendar')}
                    {/* A pre-recorded course has no meetings to schedule, so the
                        tab is not offered at all rather than shown empty. */}
                    {!isRecorded && tabBtn('sessions', <Video size={16} />, isAr ? 'الجلسات' : 'Sessions')}
                    {tabBtn('content', <BookOpen size={16} />, isAr ? 'المحتوى' : 'Content')}
                    {tabBtn('chat', <MessagesSquare size={16} />, isAr ? 'الدردشة' : 'Chat')}
                    {tabBtn('analytics', <BarChart3 size={16} />, isAr ? 'الإحصائيات' : 'Analytics')}
                </div>

                {tab === 'roster' && !!openingId && <RosterGrades openingId={String(openingId)} />}
                {tab === 'tasks' && !!openingId && <TasksPanel openingId={String(openingId)} />}
                {tab === 'announcements' && !!openingId && <InstructorAnnouncements openingId={String(openingId)} />}
                {tab === 'calendar' && !!openingId && (
                    <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                        <AcademicCalendar openingId={String(openingId)} />
                    </div>
                )}
                {tab === 'sessions' && !isRecorded && !!openingId && (
                    <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                        <LiveSessionManager openingId={String(openingId)} />
                    </div>
                )}
                {tab === 'content' && opening && !!openingId && (
                    <LessonExplorer
                        courseId={opening.course.id}
                        modules={modulesData || []}
                        chapters={syllabusData?.chapters}
                        openingId={String(openingId)}
                        mode="instructor"
                    />
                )}
                {tab === 'chat' && opening && (
                    <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                        <CourseChat courseId={opening.course.id} />
                    </div>
                )}
                {tab === 'analytics' && opening && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                                    <Users size={20} className="text-brand-gold-light" />
                                </div>
                                <p className="text-gray-400 text-sm font-bold">{isAr ? 'إجمالي الطلاب' : 'Total Students'}</p>
                            </div>
                            <p className="text-3xl font-black text-white">{studentCount ?? '—'}</p>
                        </div>
                        <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                                    <ClipboardList size={20} className="text-brand-gold-light" />
                                </div>
                                <p className="text-gray-400 text-sm font-bold">{isAr ? 'إجمالي المهام' : 'Total Tasks'}</p>
                            </div>
                            <p className="text-3xl font-black text-white">{taskCount ?? '—'}</p>
                        </div>
                        <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                                    <BookOpen size={20} className="text-brand-gold-light" />
                                </div>
                                <p className="text-gray-400 text-sm font-bold">{isAr ? 'الدورة' : 'Course'}</p>
                            </div>
                            <p className="text-lg font-black text-white leading-tight">
                                {opening ? pick(opening.course, 'title') : '—'}
                            </p>
                        </div>
                        <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                                    <Hash size={20} className="text-brand-gold-light" />
                                </div>
                                <p className="text-gray-400 text-sm font-bold">{isAr ? 'الدورة' : 'Opening'}</p>
                            </div>
                            <p className="text-lg font-black text-white leading-tight">
                                {pick(opening, 'name') || '—'}
                            </p>
                            <div className="mt-2">{statusBadge(opening.status)}</div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
