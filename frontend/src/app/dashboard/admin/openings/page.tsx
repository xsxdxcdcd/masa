"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Pencil, Trash2, Users, Search, PlusCircle, CalendarClock, Megaphone, Unlock, Play, Flag, Award, X, BookOpen, FileText, Video } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnPrimary, type Tone } from '../components';
import CertificateApprovalModal from '@/components/CertificateApprovalModal';
import OpeningRosterModal from '@/components/admin/OpeningRosterModal';
import EndedOpeningReportModal from '@/components/admin/EndedOpeningReportModal';

interface Opening {
    id: string;
    status?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    enrollmentDeadline?: string | null;
    price: string;
    priceOld?: string | null;
    maxStudents?: number | null;
    deliveryMode?: string | null;
    meetLink?: string | null;
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

type FilterKey = 'ALL' | 'OPEN' | 'PLANNED';

const isActiveStatus = (s?: string | null) => s === 'ANNOUNCEMENT' || s === 'OPEN' || s === 'STARTED';

export default function AdminOpeningsPage() {
    const { data: courses, loading, error, refetch } = useFetchData<Course[]>('/courses?includeUnpublished=true');
    const { t, pick } = useI18n();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterKey>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [modal, setModal] = useState<{ opening: Opening; startAt: string; endAt: string } | null>(null);
    const [certOpening, setCertOpening] = useState<Opening | null>(null);
    // Which batch's roster is open, so the admin can see who actually holds a
    // seat in each opening without leaving this table.
    const [rosterOpeningId, setRosterOpeningId] = useState<string | null>(null);
    // Finished batches get a read-only wrap-up: course facts, who attended, and
    // which certificates went out. Keyed by opening since that is the unit.
    const [reportOpening, setReportOpening] = useState<{ id: string; courseId: string } | null>(null);
    // An opening always belongs to a course, so "new opening" has to resolve a
    // course first. Picking it here keeps the button on this page instead of
    // bouncing the admin out to the course list.
    const [pickingCourse, setPickingCourse] = useState(false);
    const [courseQuery, setCourseQuery] = useState('');

    // Lifecycle buttons on the admin course panel link here with ?focus=<id>.
    // This table is filtered and paginated by nothing, but a target row only
    // exists in the DOM once the fetch resolves, and it can be hidden behind the
    // active filters, so drop the filters and highlight the row once it lands.
    const searchParams = useSearchParams();
    const focusId = searchParams.get('focus');
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // A ?focus= target must always be reachable, so while one is present the
    // filters are bypassed rather than cleared: resetting them in an effect
    // would fight whatever the admin had set and force an extra render.
    const effectiveStatusFilter = focusId ? 'ALL' : statusFilter;
    const effectiveQuery = focusId ? '' : query;

    useEffect(() => {
        if (!focusId || !courses) return;
        // Deferred: the row renders in the same commit as `courses`, so touching
        // state directly here would cascade an extra render.
        const timer = setTimeout(() => {
            setHighlightId(focusId);
            document.getElementById(`opening-row-${focusId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
        return () => clearTimeout(timer);
    }, [focusId, courses]);

    const courseOptions = useMemo(() => {
        const q = courseQuery.trim().toLowerCase();
        return (courses || [])
            .filter(c => !q || [c.titleAr, c.titleEn].filter(Boolean).join(' ').toLowerCase().includes(q))
            .map(c => ({ course: c, label: pick(c, 'title') || c.id.slice(0, 8) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [courses, courseQuery, pick]);

    const allOpenings: (Opening & { course?: Course })[] = (courses || []).flatMap(c =>
        (c.openings || []).map(o => ({ ...o, course: c }))
    );

    const filtered = allOpenings.filter(o => {
        if (effectiveStatusFilter === 'OPEN' && !isActiveStatus(o.status)) return false;
        if (effectiveStatusFilter === 'PLANNED' && isActiveStatus(o.status)) return false;
        if (!effectiveQuery.trim()) return true;
        const q = effectiveQuery.toLowerCase();
        return (o.nameAr || '').toLowerCase().includes(q) || (o.nameEn || '').toLowerCase().includes(q)
            || (o.course?.titleAr || '').toLowerCase().includes(q) || (o.course?.titleEn || '').toLowerCase().includes(q)
            || (o.instructor?.email || '').toLowerCase().includes(q);
    });

    const openCount = allOpenings.filter(o => isActiveStatus(o.status)).length;
    const plannedCount = allOpenings.length - openCount;

    const statusMeta = (s?: string | null): { tone: Tone; label: string } => {
        switch (s) {
            case 'ANNOUNCEMENT': return { tone: 'blue', label: t('manageCourses.status_announcement') };
            case 'OPEN': return { tone: 'green', label: t('manageCourses.status_open') };
            case 'STARTED': return { tone: 'teal', label: t('manageCourses.status_started') };
            case 'ENDED': return { tone: 'gray', label: t('manageCourses.status_ended') };
            default: return { tone: 'amber', label: t('manageCourses.status_draft') };
        }
    };

    const runLifecycle = async (o: Opening, action: 'open' | 'start' | 'end') => {
        setProcessingId(o.id);
        try {
            await api.post(`/openings/${o.id}/${action}`);
            toast.success(t('manageCourses.opening_status_updated'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('manageCourses.opening_status_fail'));
        }
        setProcessingId(null);
    };

    const openAnnounceModal = (o: Opening) => {
        const today = new Date();
        const startAt = today.toISOString().slice(0, 10);
        today.setDate(today.getDate() + 7);
        const endAt = today.toISOString().slice(0, 10);
        setModal({ opening: o, startAt, endAt });
    };

    const confirmAnnounce = async () => {
        if (!modal || !modal.startAt || !modal.endAt) return;
        setProcessingId(modal.opening.id);
        try {
            await api.post(`/openings/${modal.opening.id}/announcement`, {
                announcementStartAt: new Date(`${modal.startAt}T00:00:00Z`).toISOString(),
                announcementEndAt: new Date(`${modal.endAt}T00:00:00Z`).toISOString(),
            });
            toast.success(t('manageCourses.opening_status_updated'));
            setModal(null);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('manageCourses.opening_status_fail'));
        }
        setProcessingId(null);
    };

    const lifecycleBtn = (o: Opening) => {
        const disabled = processingId === o.id;
        const base = 'admin-action-btn tooltip disabled:opacity-40';
        switch (o.status) {
            case 'ANNOUNCEMENT':
                return (
                    <button onClick={() => runLifecycle(o, 'open')} disabled={disabled}
                        className={`${base} text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`}
                        title={t('manageCourses.action_open_tooltip')}>
                        <Unlock size={18} />
                    </button>
                );
            case 'OPEN':
                return (
                    <button onClick={() => runLifecycle(o, 'start')} disabled={disabled}
                        className={`${base} text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10`}
                        title={t('manageCourses.action_start_tooltip')}>
                        <Play size={18} />
                    </button>
                );
            case 'STARTED':
                return (
                    <button onClick={() => runLifecycle(o, 'end')} disabled={disabled}
                        className={`${base} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
                        title={t('manageCourses.action_end_tooltip')}>
                        <Flag size={18} />
                    </button>
                );
            case 'DRAFT':
                return (
                    <button onClick={() => openAnnounceModal(o)} disabled={disabled}
                        className={`${base} text-brand-navy dark:text-brand-navy-light hover:bg-brand-navy/10 dark:hover:bg-brand-navy-light/10`}
                        title={t('manageCourses.action_announce_tooltip')}>
                        <Megaphone size={18} />
                    </button>
                );
            default:
                // ENDED (and any unknown status) has no forward transition: the
                // backend rejects every lifecycle call on a finished opening, so
                // rendering a button here would only ever produce a 400.
                return null;
        }
    };

    const handleDelete = async (o: Opening) => {
        if (!window.confirm(t('manageCourses.delete_opening_confirm'))) return;
        setProcessingId(o.id);
        try {
            await api.delete(`/openings/${o.id}`);
            toast.success(t('manageCourses.opening_deleted'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('manageCourses.opening_delete_fail'));
        }
        setProcessingId(null);
    };

    const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');
    const seatsFilled = (o: Opening) => o._count?.enrollments ?? 0;
    const seatsLabel = (o: Opening) => o.maxStudents ? `${seatsFilled(o)}/${o.maxStudents}` : `${seatsFilled(o)}`;
    const seatsPct = (o: Opening) => o.maxStudents ? Math.min(100, Math.round((seatsFilled(o) / o.maxStudents) * 100)) : null;

    const filterBtn = (key: FilterKey, label: string) => (
        <button
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${statusFilter === key
                ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black shadow-md'
                : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.openings_heading')}
                subtitle={t('admin.openings_subtitle')}
                actions={
                    <>
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
                            {filterBtn('ALL', t('admin.filter_all'))}
                            {filterBtn('OPEN', `${t('admin.filter_open')} · ${openCount}`)}
                            {filterBtn('PLANNED', `${t('admin.filter_planned')} · ${plannedCount}`)}
                        </div>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={t('admin.search_openings')}
                                className="ps-9 pe-3 py-2.5 border border-gray-300 dark:border-white/10 rounded-xl text-sm w-52 bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                            />
                        </div>
                        <BtnPrimary
                            icon={PlusCircle}
                            onClick={() => { setCourseQuery(''); setPickingCourse(true); }}
                        >
                            {t('admin.new_opening')}
                        </BtnPrimary>
                    </>
                }
            />

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('admin.loading_courses')}</div>
            ) : (
                <div className="admin-table-wrap animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('admin.col_batch')}</th>
                                <th>{t('admin.col_course')}</th>
                                <th>{t('admin.col_dates')}</th>
                                <th>{t('admin.col_deadline')}</th>
                                <th>{t('manageCourses.col_price')}</th>
                                <th>{t('admin.col_seats')}</th>
                                <th>{t('admin.col_instructor')}</th>
                                <th>{t('manageCourses.col_status')}</th>
                                <th className="text-right">{t('manageCourses.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {filtered.map((o) => {
                                const pct = seatsPct(o);
                                const meta = statusMeta(o.status);
                                const hasEnrollments = seatsFilled(o) > 0;
                                return (
                                    <tr
                                        key={o.id}
                                        id={`opening-row-${o.id}`}
                                        className={`animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${
                                            highlightId === o.id
                                                ? 'bg-brand-gold/10 ring-2 ring-inset ring-brand-gold'
                                                : ''
                                        }`}
                                    >
                                        <td className="p-4 font-bold text-brand-navy dark:text-gray-200 min-w-[150px]">
                                            {pick(o, 'name') || t('manageCourses.opening_default')}
                                            {o.priceOld && <span className="block text-xs text-gray-500 dark:text-gray-400 line-through font-normal mt-0.5">${o.priceOld}</span>}
                                            {/* An online batch is the only kind that hands students a
                                                classroom link, so the admin needs to see at a glance
                                                which ones are online and whether the room is set yet. */}
                                            {o.deliveryMode === 'ONLINE' && (
                                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <Video size={10} />
                                                    {o.meetLink ? t('opening.delivery_online') : `${t('opening.delivery_online')} — ${t('opening.meet_link_missing')}`}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{pick(o.course, 'title') || o.courseId.slice(0, 8)}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div>{fmtDate(o.startDate)} → {fmtDate(o.endDate)}</div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{fmtDate(o.enrollmentDeadline)}</td>
                                        <td className="p-4 font-black text-emerald-600 dark:text-emerald-400">${o.price}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400 w-40">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="inline-flex items-center gap-1.5 font-bold"><Users size={14} className="text-gray-500 dark:text-gray-400" /> {seatsLabel(o)}</span>
                                            </div>
                                            {pct !== null && (
                                                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-dark" style={{ width: `${pct}%` }} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-[180px] truncate">{o.instructor?.email || '—'}</td>
                                        <td className="p-4">
                                            <Badge tone={meta.tone} dot>
                                                {meta.label}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => setRosterOpeningId(o.id)}
                                                className="admin-action-btn text-brand-navy dark:text-brand-navy-light hover:bg-brand-navy/10 dark:hover:bg-brand-navy-light/10 tooltip"
                                                title={t('admin.roster_view_tooltip')}
                                                aria-label={t('admin.roster_view_tooltip')}
                                            >
                                                <Users size={18} />
                                            </button>
                                            {o.status === 'ENDED' && (
                                                <>
                                                    <button
                                                        onClick={() => setReportOpening({ id: o.id, courseId: o.courseId })}
                                                        className="admin-action-btn text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 tooltip"
                                                        title={t('admin.report_view_tooltip')}
                                                        aria-label={t('admin.report_view_tooltip')}
                                                    >
                                                        <FileText size={18} />
                                                    </button>
                                                    <button onClick={() => setCertOpening(o)}
                                                        className="admin-action-btn text-brand-gold hover:bg-brand-gold/10 tooltip"
                                                        title={t('admin.cert_issue')}>
                                                        <Award size={18} />
                                                    </button>
                                                </>
                                            )}
                                            {lifecycleBtn(o)}
                                            <Link href={`/dashboard/courses/open/${o.courseId}?edit=${o.id}`}>
                                                <button className="admin-action-btn text-brand-navy dark:text-brand-navy-light hover:bg-brand-navy/10 dark:hover:bg-brand-navy-light/10 tooltip" title={t('manageCourses.edit_opening_tooltip')}>
                                                    <Pencil size={18} />
                                                </button>
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(o)}
                                                disabled={processingId === o.id || hasEnrollments}
                                                className={`admin-action-btn tooltip disabled:opacity-40 ${hasEnrollments ? 'text-gray-600 dark:text-gray-400 cursor-not-allowed' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'}`}
                                                title={hasEnrollments ? t('admin.cannot_delete_enrollments') : t('manageCourses.delete_tooltip')}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <EmptyState icon={CalendarClock} title={t('manageCourses.no_openings')} />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {rosterOpeningId && (
                <OpeningRosterModal
                    key={rosterOpeningId}
                    openingId={rosterOpeningId}
                    onClose={() => setRosterOpeningId(null)}
                />
            )}

            {reportOpening && (
                <EndedOpeningReportModal
                    key={reportOpening.id}
                    openingId={reportOpening.id}
                    courseId={reportOpening.courseId}
                    onClose={() => setReportOpening(null)}
                />
            )}

            {certOpening && (
                <CertificateApprovalModal
                    openingId={certOpening.id}
                    openingTitle={pick(certOpening, 'name') || certOpening.id}
                    canRevoke
                    onClose={() => setCertOpening(null)}
                />
            )}

            {pickingCourse && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setPickingCourse(false)}
                >
                    <div
                        className="bg-brand-navy border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-xl animate-fade-in-up max-h-[85vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-1">
                            <h3 className="text-xl font-black text-white flex-1">{t('admin.new_opening_pick_title')}</h3>
                            <button
                                onClick={() => setPickingCourse(false)}
                                className="text-gray-400 hover:text-white transition cursor-pointer"
                                aria-label={t('common.cancel')}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">{t('admin.new_opening_pick_hint')}</p>

                        <div className="relative mb-4">
                            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                autoFocus
                                value={courseQuery}
                                onChange={e => setCourseQuery(e.target.value)}
                                placeholder={t('admin.new_opening_pick_search')}
                                className="w-full ps-9 pe-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                            />
                        </div>

                        <div className="overflow-y-auto -mx-1 px-1">
                            {courseOptions.length === 0 ? (
                                <p className="text-center text-sm text-gray-400 py-8 px-4">{t('admin.new_opening_pick_empty')}</p>
                            ) : (
                                <ul className="space-y-2">
                                    {courseOptions.map(({ course, label }) => (
                                        <li key={course.id}>
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/dashboard/courses/open/${course.id}`)}
                                                className="w-full flex items-center gap-3 text-start px-4 py-3 rounded-xl bg-white/5 hover:bg-brand-gold/10 border border-white/5 hover:border-brand-gold/30 transition cursor-pointer group"
                                            >
                                                <BookOpen size={18} className="shrink-0 text-brand-gold group-hover:text-brand-gold-light transition" />
                                                <span className="flex-1 min-w-0 truncate font-bold text-white">{label}</span>
                                                <span className="shrink-0 text-xs font-bold text-gray-400">
                                                    {(course.openings || []).length}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {modal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setModal(null)}
                >
                    <div className="bg-brand-navy border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-white mb-1">{t('manageCourses.announce_title')}</h3>
                        <p className="text-sm text-gray-400 mb-5">{t('manageCourses.announce_hint')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1">{t('manageCourses.announce_start_at')}</label>
                                <input
                                    type="date"
                                    value={modal.startAt}
                                    onChange={e => setModal({ ...modal, startAt: e.target.value })}
                                    className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1">{t('manageCourses.announce_end_at')}</label>
                                <input
                                    type="date"
                                    value={modal.endAt}
                                    onChange={e => setModal({ ...modal, endAt: e.target.value })}
                                    className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmAnnounce}
                                disabled={!modal.startAt || !modal.endAt || processingId === modal.opening.id}
                                className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                            >
                                {t('manageCourses.announce_confirm')}
                            </button>
                            <button
                                onClick={() => setModal(null)}
                                className="flex-1 bg-white/5 text-gray-300 font-bold py-3 rounded-xl hover:bg-white/10 transition cursor-pointer"
                            >
                                {t('manageCourses.announce_cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
