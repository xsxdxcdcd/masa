"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/app/dashboard/admin/components';
import toast from 'react-hot-toast';
import {
    Loader, Search, Download, Check, Mail, BookOpen, CalendarClock, Circle,
    ClipboardCheck, Paperclip, Layers,
} from 'lucide-react';

interface Named {
    nameAr?: string | null;
    nameEn?: string | null;
}
interface Titled {
    titleAr?: string | null;
    titleEn?: string | null;
}

interface InboxSubmission {
    id: string;
    content?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentType?: string | null;
    attachmentSize?: number | null;
    score?: number | null;
    notes?: string | null;
    submittedAt: string;
    studentName: Named;
    enrollment?: { id: string; student: { id: string; email: string } | null } | null;
    task: {
        id: string;
        titleAr: string;
        titleEn: string;
        descriptionAr?: string | null;
        descriptionEn?: string | null;
        dueDate?: string | null;
        maxScore: number;
        opening: {
            id: string;
            nameAr?: string | null;
            nameEn?: string | null;
            course: { id: string } & Titled;
        };
        module?: ({ id: string } & Titled) | null;
    };
}

interface InboxResponse {
    items: InboxSubmission[];
    total: number;
    hasMore: boolean;
}

interface CourseOption {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
}

/** A submitted file is shown with its size; a bare "attachment" is unhelpful. */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileHref(url: string): string {
    return url.startsWith('/') ? API_BASE_URL + url : url;
}

export default function SubmissionsInboxPage() {
    const { t, pick, locale } = useI18n();
    const isAr = locale === 'ar';

    const PAGE = 25;

    const [courseId, setCourseId] = useState('');
    const [ungradedOnly, setUngradedOnly] = useState(false);
    const [query, setQuery] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, { score: string; notes: string }>>({});

    const [items, setItems] = useState<InboxSubmission[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Bumped after a grade is saved, to pull the first page again. */
    const [reload, setReload] = useState(0);

    // Course titles seen so far, so a filter stays listed after it narrows the
    // result set to nothing. Without this the <select> loses its own selected
    // option and falls back to "all courses" while the request is still scoped
    // to that course — a filter that looks off but is not.
    const courseCatalog = useRef(new Map<string, CourseOption>());
    const recordCourses = (rows: InboxSubmission[]) => {
        for (const s of rows) {
            const c = s.task.opening?.course;
            if (c && !courseCatalog.current.has(c.id)) {
                courseCatalog.current.set(c.id, { id: c.id, titleAr: c.titleAr, titleEn: c.titleEn });
            }
        }
    };

    const buildUrl = (skip: number) => {
        const params = new URLSearchParams();
        if (courseId) params.set('courseId', courseId);
        if (ungradedOnly) params.set('ungraded', 'true');
        params.set('limit', String(PAGE));
        if (skip > 0) params.set('skip', String(skip));
        return `/tasks/submissions?${params.toString()}`;
    };

    // The filters that narrow the result set go to the server, because the
    // endpoint is what decides which batches this instructor may read at all.
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);
        api.get<InboxResponse>(buildUrl(0), { signal: ctrl.signal })
            .then((res) => {
                recordCourses(res.data.items ?? []);
                setItems(res.data.items ?? []);
                setTotal(res.data.total ?? 0);
            })
            .catch((err) => {
                if (ctrl.signal.aborted) return;
                setError(getErrorMessage(err) || t('submissionsInbox.load_fail'));
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });
        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, ungradedOnly, reload, t]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const res = await api.get<InboxResponse>(buildUrl(items.length));
            recordCourses(res.data.items ?? []);
            setItems((prev) => [...prev, ...(res.data.items ?? [])]);
            setTotal(res.data.total ?? 0);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('submissionsInbox.load_fail'));
        } finally {
            setLoadingMore(false);
        }
    };

    // The dropdown is built from the rows this teacher has actually received
    // work in, not from the course catalogue. `/courses` is public
    // (OptionalJwtAuthGuard), so it offers every course on the platform —
    // nearly all of which resolve to an empty list for this teacher, because
    // the endpoint scopes by the two instructor columns. Titles accumulate in
    // `courseCatalog` as pages arrive so the active filter never disappears.
    const courseOptions = useMemo(() => {
        return [...courseCatalog.current.values()].sort((a, b) =>
            (pick(a, 'title') || '').localeCompare(pick(b, 'title') || '', isAr ? 'ar' : 'en'),
        );
    }, [items, isAr, pick]);

    // The free-text box filters what has been loaded rather than the whole
    // table: the student's name lives in `User.metadata`, which is a JSON blob
    // keyed by `fullName` / `nameAr` / `nameEn` with no index, so a
    // server-side "contains" would have to guess which key the account filled
    // in. The counter below says how much is loaded, so the gap is visible.
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((s) => {
            const student = `${s.studentName?.nameAr ?? ''} ${s.studentName?.nameEn ?? ''} ${s.enrollment?.student?.email ?? ''}`;
            const task = `${s.task.titleAr} ${s.task.titleEn} ${s.task.opening?.nameAr ?? ''} ${s.task.opening?.nameEn ?? ''} ${s.task.opening?.course?.titleAr ?? ''} ${s.task.opening?.course?.titleEn ?? ''}`;
            return `${student} ${task}`.toLowerCase().includes(q);
        });
    }, [items, query]);

    const ungradedCount = items.filter((s) => s.score == null).length;

    const saveGrade = async (sub: InboxSubmission) => {
        const draft = drafts[sub.id];
        const raw = draft?.score ?? (sub.score != null ? String(sub.score) : '');
        const score = raw.trim() === '' ? null : Number(raw);
        // `gradeSubmission` treats a missing score as "leave the mark alone"
        // (it writes `submission.score` back), so an emptied box would look
        // like it saved while quietly keeping the old mark. Refuse instead of
        // pretending; removing a mark is a backend change, not a UI one.
        if (score == null && sub.score != null) {
            toast.error(t('submissionsInbox.cannot_ungrade'));
            return;
        }
        if (score != null && (!Number.isFinite(score) || score < 0)) {
            toast.error(t('tasks.grade_invalid'));
            return;
        }
        if (score != null && score > sub.task.maxScore) {
            toast.error(`${t('tasks.score')} ≤ ${sub.task.maxScore}`);
            return;
        }
        setSavingId(sub.id);
        try {
            await api.patch(`/tasks/submissions/${sub.id}/grade`, {
                score: score ?? undefined,
                notes: draft?.notes ?? (sub.notes ?? undefined),
            });
            toast.success(t('submissionsInbox.grade_saved'));
            setDrafts((p) => { const n = { ...p }; delete n[sub.id]; return n; });
            setReload((n) => n + 1);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('submissionsInbox.grade_fail'));
        } finally {
            setSavingId(null);
        }
    };

    const fmtDateTime = (v?: string | null) =>
        v ? new Date(v).toLocaleString(isAr ? 'ar-SA' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const fmtDate = (v?: string | null) =>
        v ? new Date(v).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }) : '—';

    return (
        <ProtectedRoute allowedRoles={['INSTRUCTOR']}>
            <div className="space-y-6 animate-fade-in">
                <PageHeader
                    title={t('submissionsInbox.title')}
                    subtitle={t('submissionsInbox.subtitle')}
                />

                {/* Filters */}
                <div className="bg-surface border border-line rounded-2xl p-4 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-xs font-bold text-ink-subtle mb-1.5">
                            <Search size={12} className="inline me-1" />
                            {t('common.search')}
                        </label>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('submissionsInbox.search_placeholder')}
                            className="w-full px-3.5 py-2.5 bg-surface-sunken border border-line rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:ring-2 focus:ring-accent/40 outline-none transition"
                        />
                    </div>
                    <div className="min-w-[200px]">
                        <label className="block text-xs font-bold text-ink-subtle mb-1.5">
                            <BookOpen size={12} className="inline me-1" />
                            {t('submissionsInbox.course_label')}
                        </label>
                        <select
                            value={courseId}
                            onChange={(e) => setCourseId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-surface-sunken border border-line rounded-xl text-sm text-ink focus:ring-2 focus:ring-accent/40 outline-none transition"
                        >
                            <option value="">{t('submissionsInbox.all_courses')}</option>
                            {courseOptions.map((c) => (
                                <option key={c.id} value={c.id}>{pick(c, 'title')}</option>
                            ))}
                        </select>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-surface-sunken text-sm font-bold text-ink cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={ungradedOnly}
                            onChange={(e) => setUngradedOnly(e.target.checked)}
                            className="accent-brand-gold w-4 h-4 cursor-pointer"
                        />
                        {t('submissionsInbox.ungraded_only')}
                        {ungradedCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-warning-soft text-warning text-[10px] font-black">
                                {ungradedCount}
                            </span>
                        )}
                    </label>
                </div>

                {error && (
                    <div className="p-4 bg-danger-soft border border-danger/20 text-danger rounded-xl font-bold">
                        {error}
                    </div>
                )}

                {!loading && items.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-ink-subtle bg-surface border border-line rounded-xl px-4 py-3">
                        <span className="font-bold">
                            {t('submissionsInbox.showing')} {items.length} / {total}
                        </span>
                        {items.length < total && (
                            <>
                                <span className="text-xs">
                                    {query.trim()
                                        ? t('submissionsInbox.search_loaded_note')
                                        : t('submissionsInbox.more_available')}
                                </span>
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="ms-auto inline-flex items-center gap-1.5 bg-surface-sunken border border-line hover:border-accent/40 px-4 py-2 rounded-xl text-xs font-black text-ink transition disabled:opacity-50 cursor-pointer"
                                >
                                    {loadingMore
                                        ? <Loader size={14} className="animate-spin" />
                                        : <Layers size={14} />}
                                    {t('submissionsInbox.load_more')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="h-40 flex items-center justify-center text-ink-subtle font-bold">
                        <Loader className="animate-spin me-2" size={20} /> {t('common.loading')}
                    </div>
                ) : visible.length === 0 ? (
                    <div className="text-center py-16 text-ink-subtle border-2 border-dashed border-line rounded-2xl">
                        <ClipboardCheck size={40} className="mx-auto mb-3 opacity-50" />
                        <p className="font-bold">
                            {items.length === 0 ? t('submissionsInbox.no_submissions') : t('submissionsInbox.no_results')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visible.map((sub) => {
                            const email = sub.enrollment?.student?.email ?? '—';
                            const who = pick(sub.studentName, 'name') || email;
                            const opening = sub.task.opening;
                            const courseTitle = pick(opening?.course, 'title');
                            const batchTitle = pick(opening, 'name') || t('submissionsInbox.no_batch_name');
                            const taskTitle = pick(sub.task, 'title');
                            const description = pick(sub.task, 'description');
                            const isLate = !!sub.task.dueDate && new Date(sub.submittedAt) > new Date(sub.task.dueDate);
                            const graded = sub.score != null;
                            const draft = drafts[sub.id];

                            return (
                                <article key={sub.id} className="bg-surface border border-line rounded-2xl overflow-hidden hover:border-accent/30 transition-colors">
                                    {/* Context strip: which course / batch / lecture this belongs to */}
                                    <div className="px-5 py-3 bg-surface-sunken border-b border-line flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-ink-subtle">
                                        <span className="inline-flex items-center gap-1.5 text-accent">
                                            <BookOpen size={13} /> {courseTitle}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <CalendarClock size={13} /> {batchTitle}
                                        </span>
                                        {sub.task.module && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Layers size={13} /> {pick(sub.task.module, 'title')}
                                            </span>
                                        )}
                                        <span className="ms-auto">
                                            {t('submissionsInbox.max_score_label')} {sub.task.maxScore}
                                        </span>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        {/* Task + student identity */}
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="text-base font-black text-ink leading-snug">{taskTitle}</h3>
                                                <p className="text-sm text-ink-muted font-bold mt-0.5 inline-flex items-center gap-1.5">
                                                    <Mail size={13} className="text-ink-subtle" /> {who}
                                                    {sub.studentName && who !== email && (
                                                        <span className="text-xs font-semibold text-ink-subtle" dir="ltr">{email}</span>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                {isLate && (
                                                    <span className="px-2.5 py-1 rounded-lg bg-danger-soft text-danger border border-danger/20 text-[10px] font-black">
                                                        {t('submissionsInbox.late')}
                                                    </span>
                                                )}
                                                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black ${graded
                                                    ? 'bg-success-soft text-success border-success/20'
                                                    : 'bg-warning-soft text-warning border-warning/20'}`}>
                                                    {graded ? t('submissionsInbox.graded') : t('submissionsInbox.ungraded')}
                                                </span>
                                            </div>
                                        </div>

                                        {/* What the task asked for, and the dates */}
                                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                            <div className="bg-surface-sunken border border-line rounded-xl px-4 py-3">
                                                <p className="text-[10px] font-black text-ink-subtle uppercase tracking-wider mb-1">
                                                    {t('tasks.tasks_title')}
                                                </p>
                                                <p className="text-ink-muted whitespace-pre-wrap">
                                                    {description || t('tasks.no_description')}
                                                </p>
                                            </div>
                                            <div className="bg-surface-sunken border border-line rounded-xl px-4 py-3 flex flex-col justify-center gap-1 text-sm">
                                                <p className="text-ink-muted">
                                                    <span className="text-ink-subtle font-bold">{t('submissionsInbox.submitted_label')}:</span>{' '}
                                                    {fmtDateTime(sub.submittedAt)}
                                                </p>
                                                <p className="text-ink-muted">
                                                    <span className="text-ink-subtle font-bold">{t('submissionsInbox.due_label')}:</span>{' '}
                                                    {fmtDate(sub.task.dueDate)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* The work itself */}
                                        <div className="text-sm text-ink bg-ink/[0.04] rounded-xl px-4 py-3 whitespace-pre-wrap">
                                            {sub.content || t('submissionsInbox.no_content')}
                                        </div>

                                        {sub.attachmentUrl && (
                                            <a
                                                href={fileHref(sub.attachmentUrl)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-accent transition"
                                            >
                                                <Download size={15} />
                                                <Paperclip size={13} className="text-ink-subtle" />
                                                {sub.attachmentName || t('tasks.attachment')}
                                                {sub.attachmentSize ? (
                                                    <span className="text-xs font-semibold text-ink-subtle">
                                                        ({formatFileSize(sub.attachmentSize)})
                                                    </span>
                                                ) : null}
                                                {sub.attachmentType ? (
                                                    <span className="text-[10px] font-bold text-ink-subtle uppercase" dir="ltr">
                                                        {sub.attachmentType.split('/').pop()}
                                                    </span>
                                                ) : null}
                                            </a>
                                        )}

                                        {/* Grading */}
                                        <div className="pt-4 border-t border-line grid sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
                                            <div>
                                                <label className="block text-xs font-bold text-ink-subtle mb-1.5">
                                                    {t('submissionsInbox.score')} / {sub.task.maxScore}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    dir="ltr"
                                                    value={draft?.score ?? (sub.score != null ? String(sub.score) : '')}
                                                    onChange={(e) => setDrafts((p) => ({ ...p, [sub.id]: { score: e.target.value, notes: p[sub.id]?.notes ?? '' } }))}
                                                    placeholder={t('tasks.score_placeholder')}
                                                    className="w-full px-3.5 py-2.5 bg-surface-sunken border border-line rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:ring-2 focus:ring-accent/40 outline-none transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-ink-subtle mb-1.5">
                                                    {t('submissionsInbox.notes')}
                                                </label>
                                                <input
                                                    value={draft?.notes ?? (sub.notes ?? '')}
                                                    onChange={(e) => setDrafts((p) => ({ ...p, [sub.id]: { score: p[sub.id]?.score ?? '', notes: e.target.value } }))}
                                                    placeholder={t('tasks.notes_placeholder')}
                                                    className="w-full px-3.5 py-2.5 bg-surface-sunken border border-line rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:ring-2 focus:ring-accent/40 outline-none transition"
                                                />
                                            </div>
                                            <button
                                                onClick={() => saveGrade(sub)}
                                                disabled={savingId === sub.id}
                                                className="inline-flex items-center justify-center gap-1.5 bg-brand-gold hover:bg-brand-gold-light text-ink-on-gold text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50 cursor-pointer"
                                            >
                                                {savingId === sub.id
                                                    ? <Loader size={15} className="animate-spin" />
                                                    : <Check size={15} />}
                                                {t('submissionsInbox.grade')}
                                            </button>
                                        </div>

                                        {graded && sub.notes && (
                                            <p className="text-xs text-ink-subtle font-semibold inline-flex items-center gap-1.5">
                                                <Circle size={8} className="fill-current" />
                                                {t('tasks.current_grade')}: {sub.score} — {sub.notes}
                                            </p>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
