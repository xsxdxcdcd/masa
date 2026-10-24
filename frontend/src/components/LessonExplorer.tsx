"use client";

import { useEffect, useState } from 'react';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import {
    Loader, CheckCircle, FileText, Link2, Download, ClipboardList, Send, Clock, Film, ListChecks, ChevronDown, Radio, Target,
} from 'lucide-react';
import { EmptyPanel } from '@/app/dashboard/admin/components';

interface TaskLink {
    url: string;
    labelAr?: string | null;
    labelEn?: string | null;
}

interface TaskSubmission {
    id: string;
    content?: string | null;
    attachmentUrl?: string | null;
    score?: number | null;
    notes?: string | null;
    submittedAt?: string | null;
    enrollment?: { id?: string; student?: { id?: string; email?: string } } | null;
}

interface LessonTask {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    dueDate?: string | null;
    maxScore: number;
    moduleId?: string | null;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    links?: TaskLink[] | null;
    submissions?: TaskSubmission[] | null;
}

interface LessonModule {
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

interface LessonChapter {
    titleAr?: string | null;
    titleEn?: string | null;
    modules?: LessonModule[] | null;
}

interface Props {
    courseId: string;
    modules: LessonModule[];
    chapters?: LessonChapter[] | null;
    openingId?: string | null;
    mode: 'guest' | 'student' | 'instructor';
    /** LIVE: the lessons are the meetings. RECORDED: the lessons are videos. */
    contentType?: 'LIVE' | 'RECORDED' | null;
}

export default function LessonExplorer({ courseId, modules, chapters = null, openingId = null, mode, contentType = null }: Props) {
    const { t, pick } = useI18n();
    // A live lesson has no running time of its own -- the meeting does -- so the
    // outline stops advertising a video length it does not have. Missing means a
    // payload from before the field existed, which is live by the column default.
    const isLive = contentType !== 'RECORDED';
    const grouped: LessonChapter[] = chapters && chapters.length ? chapters : [{ titleAr: '', titleEn: '', modules }];
    const allModules = grouped.flatMap((c) => c.modules || []);
    const [selectedId, setSelectedId] = useState<string | null>(() => allModules[0]?.id ?? null);
    const [openChs, setOpenChs] = useState<Record<number, boolean>>({});
    const [tasks, setTasks] = useState<LessonTask[] | null>(null);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [scores, setScores] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [savingGrade, setSavingGrade] = useState<string | null>(null);

    const fetchTasks = async (): Promise<LessonTask[] | null> => {
        if (mode === 'guest') return [];
        // A student has no business resolving a batch id: the enrollment row may
        // never have recorded one, and the course-scoped route decides that
        // server-side under the same single-batch rule as everything else.
        if (mode === 'student') {
            if (typeof window === 'undefined' || !localStorage.getItem('laxalab_token')) return [];
            const res = await api.get(`/tasks/course/${courseId}`);
            return res.data || [];
        }
        const oid = openingId ?? null;
        if (!oid) return [];
        const res = await api.get(`/tasks/opening/${oid}`);
        return res.data || [];
    };

    useEffect(() => {
        let active = true;
        (async () => {
            setLoadingTasks(true);
            try {
                const data = await fetchTasks();
                if (active) setTasks(data);
            } catch (err) {
                if (active) toast.error(getErrorMessage(err) || t('tasks.load_fail'));
            } finally {
                if (active) setLoadingTasks(false);
            }
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, mode, openingId]);

    const reloadTasks = async () => {
        setLoadingTasks(true);
        try {
            setTasks(await fetchTasks());
        } catch (err) {
            toast.error(getErrorMessage(err) || t('tasks.load_fail'));
        } finally {
            setLoadingTasks(false);
        }
    };

    const handleSubmit = async (taskId: string) => {
        const content = (drafts[taskId] || '').trim();
        if (!content) return;
        setSubmittingId(taskId);
        try {
            await api.post(`/tasks/${taskId}/submit`, { content });
            toast.success(t('tasks.submit_success'));
            setDrafts((p) => { const n = { ...p }; delete n[taskId]; return n; });
            await reloadTasks();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('tasks.load_fail'));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleGrade = async (task: LessonTask, sub: TaskSubmission) => {
        const score = scores[sub.id];
        if (score === undefined || score === '' || isNaN(Number(score))) {
            toast.error(t('tasks.grade_invalid'));
            return;
        }
        setSavingGrade(sub.id);
        try {
            await api.patch(`/tasks/submissions/${sub.id}/grade`, {
                score: Number(score),
                notes: (notes[sub.id] || '').trim() || undefined,
            });
            toast.success(t('tasks.grade_saved'));
            setScores((p) => { const n = { ...p }; delete n[sub.id]; return n; });
            setNotes((p) => { const n = { ...p }; delete n[sub.id]; return n; });
            await reloadTasks();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('tasks.grade_fail'));
        } finally {
            setSavingGrade(null);
        }
    };

    const getVideoUrl = (url?: string | null) => {
        if (!url) return null;
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
        const vm = url.match(/vimeo\.com\/(\d+)/);
        if (yt) return { type: 'embed', src: `https://www.youtube.com/embed/${yt[1]}` } as const;
        if (vm) return { type: 'embed', src: `https://player.vimeo.com/video/${vm[1]}` } as const;
        if (url.startsWith('/uploads') || /\.(mp4|webm|mov)$/i.test(url)) return { type: 'file', src: url } as const;
        return { type: 'embed', src: url } as const;
    };

    const selected = allModules.find((m) => m.id === selectedId) ?? allModules[0];
    const isOpen = (ci: number) => openChs[ci] ?? true;
    const toggleCh = (ci: number) => setOpenChs((p) => ({ ...p, [ci]: !(p[ci] ?? true) }));
    const tasksByModule: Record<string, LessonTask[]> = {};
    (tasks || []).forEach((tk) => {
        if (tk.moduleId) {
            if (!tasksByModule[tk.moduleId]) tasksByModule[tk.moduleId] = [];
            tasksByModule[tk.moduleId].push(tk);
        }
    });
    const selectedTasks = selected ? (tasksByModule[selected.id] || []) : [];

    if (allModules.length === 0) {
        return <EmptyPanel icon={ListChecks} title={t('lessons.no_modules')} />;
    }

    const inputCls = "w-full px-3 py-2.5 bg-surface-raised border border-brand-mist rounded-xl focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition text-placeholder:ink-subtle";

    return (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
            {/* Outline */}
            <aside className="space-y-4">
                <div className="bg-surface-raised border border-brand-mist rounded-[1.5rem] p-5 shadow-sm lg:sticky lg:top-24">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-brand-mist/70">
                        <h3 className="font-black text-ink flex items-center gap-2">
                            <ListChecks size={17} className="text-accent" /> {t('lessons.outline_heading')}
                        </h3>
                        <span className="text-xs font-bold text-ink-muted bg-ink/[0.06] rounded-full px-2.5 py-1">{allModules.length} {t('lessons.lesson_label')}</span>
                    </div>
                    {/* No locked-lesson teaser: a syllabus that only reveals itself once you pay
                        cannot answer "what does this course teach me" before the
                        decision, which is the question this outline is for. */}
                    <nav className="space-y-3">
                        {grouped.map((ch, ci) => {
                            const chModules = ch.modules || [];
                            const chDuration = chModules.reduce((s, m) => s + (m.durationMinutes || 0), 0);
                            return (
                                <div key={ci} className="border border-brand-mist rounded-2xl overflow-hidden bg-surface-raised">
                                    <button
                                        onClick={() => toggleCh(ci)}
                                        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-ink/[0.03] transition cursor-pointer text-left rtl:text-right"
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <ChevronDown size={16} className={`text-accent transition-transform flex-shrink-0 ${isOpen(ci) ? 'rotate-180' : ''}`} />
                                            <span className="font-black text-ink text-sm truncate">{pick(ch, 'title') || t('lessons.lesson_label')}</span>
                                        </span>
                                        <span className="flex items-center gap-2 text-xs font-bold text-ink-subtle shrink-0">
                                            {!isLive && chDuration > 0 && <span className="flex items-center gap-1"><Clock size={12} /> {chDuration} {t('lessons.minutes_short')}</span>}
                                            <span className="bg-surface-sunken rounded-full px-2 py-0.5">{chModules.length}</span>
                                        </span>
                                    </button>
                                    {isOpen(ci) && (
                                        <div className="px-2 pb-2 space-y-1.5 border-t border-brand-mist/60">
                                            {chModules.map((m, idx) => {
                                                const fileCount = (m.files?.length || 0) + (m.links?.length || 0);
                                                const taskCount = tasksByModule[m.id]?.length || 0;
                                                const active = selected?.id === m.id;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setSelectedId(m.id)}
                                                        className={`w-full flex items-center gap-3 text-left rtl:text-right px-3 py-2.5 rounded-xl border transition cursor-pointer ${
                                                            active
                                                                ? 'bg-surface text-ink border-brand-navy shadow-md shadow-brand-navy/20'
                                                                : 'bg-surface-raised text-ink-subtle border-brand-mist hover:border-brand-gold hover:text-ink'
                                                        }`}
                                                    >
                                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-brand-gold text-ink-on-gold' : 'bg-surface-sunken text-ink'}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span className="flex-1 min-w-0 truncate text-sm font-bold">{pick(m, 'title')}</span>
                                                        <span className="flex items-center gap-1 text-xs shrink-0">
                                                            {!isLive && !!m.durationMinutes && <span className="flex items-center gap-1 font-bold opacity-80"><Clock size={12} /> {m.durationMinutes} {t('lessons.minutes_short')}</span>}
                                                            {m.videoUrl && <Film size={13} className={active ? 'text-accent' : 'text-accent'} />}
                                                            {fileCount > 0 && <FileText size={13} className={active ? 'text-accent' : 'text-accent'} />}
                                                            {taskCount > 0 && <span className={`px-1.5 rounded-full font-black ${active ? 'bg-brand-gold text-ink-on-gold' : 'bg-brand-gold/20 text-gold-ink'}`}>{taskCount}</span>}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </div>
            </aside>

            {/* Mobile picker */}
            <div className="lg:hidden">
                <select
                    value={selected?.id ?? ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full px-3 py-3 bg-surface-raised border border-brand-mist rounded-xl font-bold text-ink focus:ring-2 focus:ring-brand-gold outline-none"
                >
                    {grouped.map((ch, ci) => (
                        <optgroup key={ci} label={pick(ch, 'title') || t('lessons.lesson_label')}>
                            {(ch.modules || []).map((m, mi) => (
                                <option key={m.id} value={m.id}>
                                    {mi + 1}. {pick(m, 'title')}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            {/* Lesson content */}
            <div className="min-w-0">
                {selected ? (
                    <article className="border border-brand-mist rounded-[1.5rem] overflow-hidden bg-surface-raised shadow-lg shadow-brand-navy/5">
                        <div className="px-5 md:px-6 py-5 bg-gradient-to-r from-brand-gold/15 via-brand-mist/40 to-transparent border-b border-brand-mist/60 flex items-start gap-4">
                            <div className="bg-surface text-accent w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-md shadow-brand-navy/20">
                                {allModules.findIndex((m) => m.id === selected.id) + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-black text-ink text-xl">{pick(selected, 'title')}</h3>
                                    {!isLive && !!selected.durationMinutes && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted bg-ink/[0.06] rounded-full px-2.5 py-0.5">
                                            <Clock size={12} /> {selected.durationMinutes} {t('lessons.minutes_short')}
                                        </span>
                                    )}
                                </div>
                                {pick(selected, 'description') && <p className="text-sm text-ink-subtle mt-1">{pick(selected, 'description')}</p>}
                            </div>
                        </div>

                        <div className="p-5 space-y-6">
                            {/* What the lesson actually is, so a live course does not
                                read as a video course with the video missing. */}
                            {isLive && (
                                <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.03] px-4 py-3 text-sm font-bold text-ink-muted">
                                    <Radio size={15} className="text-red-600 dark:text-red-400 shrink-0" />
                                    {t('lessons.live_note')}
                                </div>
                            )}
                            {/* The lesson's own agenda and payoff: what it covers and
                                what the student walks away with. Public on purpose --
                                it answers "what do I learn here", and an enrolment gate
                                on that answer hides the syllabus from the people the
                                course page exists for. */}
                            {(selected.outcomes?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-line bg-surface-sunken p-4">
                                    <h4 className="text-xs font-black text-ink uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                        <Target size={14} className="text-accent" /> {t('lessons.topics_heading')}
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {(selected.outcomes || []).map((o, oi) => (
                                            <li key={oi} className="flex items-start gap-2 text-sm text-ink-muted">
                                                <CheckCircle size={13} className="text-accent mt-0.5 shrink-0" />
                                                <span>{pick(o, 'description')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {/* The lesson description counts as content even though
                                it is not a file: without this a lesson whose only
                                body is prose was reported as having none. */}
                            {(
                                (getVideoUrl(selected.videoUrl))
                                || (selected.files && selected.files.length > 0)
                                || (selected.links && selected.links.length > 0)
                                || selectedTasks.length > 0
                                || (selected.outcomes && selected.outcomes.length > 0)
                                || (selected.descriptionAr || selected.descriptionEn)
                            ) ? (
                                <>
                                    {(() => {
                                        const vid = getVideoUrl(selected.videoUrl);
                                        return vid ? (
                                            <div className="rounded-xl overflow-hidden border border-line aspect-video bg-black">
                                                {vid.type === 'embed' ? (
                                                    <iframe src={vid.src} title={pick(selected, 'title') || undefined} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                                                ) : (
                                                    <video src={`${API_BASE_URL}${vid.src}`} controls className="w-full h-full" />
                                                )}
                                            </div>
                                        ) : null;
                                    })()}

                                    {(selected.files && selected.files.length > 0) && (
                                        <div>
                                            <h4 className="text-xs font-black text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <FileText size={14} className="text-accent" /> {t('courseDetail.lesson_files')}
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selected.files.map((f, fi) => (
                                                    <a key={fi} href={f.url.startsWith('/') ? API_BASE_URL + f.url : f.url} target="_blank" rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-sm font-bold text-ink border border-brand-mist rounded-lg px-3 py-2 hover:border-brand-gold hover:text-accent transition">
                                                        <Download size={14} /> {pick(f, 'name') || f.url.split('/').pop() || f.url}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(selected.links && selected.links.length > 0) && (
                                        <div>
                                            <h4 className="text-xs font-black text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Link2 size={14} className="text-accent" /> {t('courseDetail.lesson_links')}
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selected.links.map((lk, li) => (
                                                    <a key={li} href={lk.url} target="_blank" rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-sm font-bold text-ink border border-brand-mist rounded-lg px-3 py-2 hover:border-brand-gold hover:text-accent transition">
                                                        <Link2 size={14} /> {pick(lk, 'label') || lk.url}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : isLive ? null : (
                                /* A live lesson is not an unfinished one: it is
                                 * delivered in the session named above, so telling
                                 * the visitor there is "no content yet" is both
                                 * false and the reason the page read as broken. */
                                <p className="text-sm text-ink-subtle font-bold text-center py-4">{t('lessons.empty_hint')}</p>
                            )}

                            {/* Tasks of this lesson (enrolled learners only) */}
                            {mode !== 'guest' && (
                                <div>
                                <h4 className="text-xs font-black text-ink uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <ClipboardList size={14} className="text-accent" /> {t('lessons.tasks_heading')}
                                </h4>
                                {loadingTasks && !tasks ? (
                                    <div className="h-24 flex items-center justify-center text-ink"><Loader className="animate-spin" size={24} /></div>
                                ) : selectedTasks.length === 0 ? (
                                    <p className="text-sm text-ink-subtle font-bold">{t('lessons.no_tasks')}</p>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedTasks.map((task) => {
                                            const overdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
                                            const mySubmission = mode === 'student' ? (task.submissions?.[0] ?? null) : null;
                                            const graded = typeof mySubmission?.score === 'number';
                                            return (
                                                <div key={task.id} className="border border-brand-mist rounded-xl overflow-hidden">
                                                    <div className="px-4 py-3 bg-ink/[0.02] border-b border-brand-mist/60 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="font-bold text-ink text-sm flex items-center gap-2">
                                                            <ClipboardList size={15} className="text-accent" />
                                                            {pick(task, 'title')}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-bold">
                                                            {task.dueDate && (
                                                                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${overdue ? 'bg-danger-soft text-danger dark:text-danger' : 'bg-surface-sunken text-ink-subtle'}`}>
                                                                    <Clock size={12} /> {t('tasks.due_on')} {new Date(task.dueDate).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            <span className="bg-surface text-ink px-2.5 py-1 rounded-lg">{t('tasks.max_score_label')} {task.maxScore}</span>
                                                        </div>
                                                    </div>

                                                    <div className="px-4 py-3 space-y-3">
                                                        {pick(task, 'description') && <p className="text-sm text-ink-subtle whitespace-pre-wrap">{pick(task, 'description')}</p>}

                                                        {(task.attachmentUrl || task.links?.length) ? (
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                                                {task.attachmentUrl && (
                                                                    <a href={task.attachmentUrl.startsWith('/') ? API_BASE_URL + task.attachmentUrl : task.attachmentUrl} target="_blank" rel="noreferrer"
                                                                        className="inline-flex items-center gap-1.5 font-bold text-ink hover:text-accent transition">
                                                                        <Download size={14} /> {t('tasks.attachment')}
                                                                    </a>
                                                                )}
                                                                {(task.links || []).map((lk, i) => (
                                                                    <a key={i} href={lk.url} target="_blank" rel="noreferrer"
                                                                        className="inline-flex items-center gap-1.5 font-bold text-ink hover:text-accent transition">
                                                                        <Link2 size={14} /> {pick(lk, 'label') || lk.url}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        ) : null}

                                                        {mode === 'student' ? (
                                                            graded ? (
                                                                <div className="flex items-center gap-2 text-sm font-bold text-success dark:text-success bg-success-soft border border-line rounded-xl p-3">
                                                                    <CheckCircle size={16} />
                                                                    {t('tasks.current_grade')}: {mySubmission?.score} / {task.maxScore}
                                                                    {mySubmission?.notes ? ` — ${mySubmission.notes}` : ''}
                                                                </div>
                                                            ) : mySubmission ? (
                                                                <div className="text-sm text-ink-muted bg-ink/[0.03] border border-brand-mist rounded-xl p-3">
                                                                    {t('tasks.submitted_at')} {mySubmission.submittedAt ? new Date(mySubmission.submittedAt).toLocaleString() : ''}
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <textarea
                                                                        value={drafts[task.id] || ''}
                                                                        onChange={(e) => setDrafts((p) => ({ ...p, [task.id]: e.target.value }))}
                                                                        rows={2}
                                                                        placeholder={t('lessons.answer_placeholder')}
                                                                        className={inputCls}
                                                                    />
                                                                    <button
                                                                        onClick={() => handleSubmit(task.id)}
                                                                        disabled={submittingId === task.id || !(drafts[task.id] || '').trim()}
                                                                        className="mt-2 inline-flex items-center gap-2 bg-surface hover:bg-brand-charcoal text-ink disabled:opacity-40 px-5 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer disabled:cursor-not-allowed"
                                                                    >
                                                                        {submittingId === task.id ? <Loader size={14} className="animate-spin" /> : <Send size={14} />} {t('common.submit')}
                                                                    </button>
                                                                </div>
                                                            )
                                                        ) : (task.submissions?.length ?? 0) === 0 ? (
                                                                <p className="text-sm text-ink-subtle font-bold">{t('tasks.no_submissions')}</p>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {(task.submissions || []).map((sub) => {
                                                                    const email = sub.enrollment?.student?.email ?? '—';
                                                                    return (
                                                                        <div key={sub.id} className="border border-brand-mist rounded-xl p-3 bg-surface-raised">
                                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                                                <span className="text-xs font-bold text-ink">{email}</span>
                                                                                <span className="text-xs text-ink-subtle font-semibold">
                                                                                    {t('tasks.submitted_at')}: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-sm text-ink-muted bg-ink/[0.03] rounded-xl px-3 py-2 mb-2 whitespace-pre-wrap">
                                                                                {sub.content || t('tasks.no_content')}
                                                                            </div>
                                                                            {sub.attachmentUrl && (
                                                                                <a href={sub.attachmentUrl.startsWith('/') ? API_BASE_URL + sub.attachmentUrl : sub.attachmentUrl} target="_blank" rel="noreferrer"
                                                                                    className="inline-flex items-center gap-1.5 text-sm font-bold text-ink hover:text-accent transition">
                                                                                    <Download size={14} /> {t('tasks.attachment')}
                                                                                </a>
                                                                            )}
                                                                            <div className="mt-2 grid sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
                                                                                <div>
                                                                                    <label className="block text-xs font-bold text-ink-subtle mb-1">{t('tasks.score')} / {task.maxScore}</label>
                                                                                    <input
                                                                                        type="number" step="any" min={0}
                                                                                        value={scores[sub.id] ?? (sub.score != null ? String(sub.score) : '')}
                                                                                        onChange={(e) => setScores((p) => ({ ...p, [sub.id]: e.target.value }))}
                                                                                        className={inputCls} placeholder={t('tasks.score_placeholder')}
                                                                                    />
                                                                                </div>
                                                                                <div>
                                                                                    <label className="block text-xs font-bold text-ink-subtle mb-1">{t('tasks.notes')}</label>
                                                                                    <input
                                                                                        value={notes[sub.id] ?? (sub.notes ?? '')}
                                                                                        onChange={(e) => setNotes((p) => ({ ...p, [sub.id]: e.target.value }))}
                                                                                        className={inputCls} placeholder={t('tasks.notes_placeholder')}
                                                                                    />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleGrade(task, sub)}
                                                                                    disabled={savingGrade === sub.id}
                                                                                    className="inline-flex items-center gap-1.5 justify-center bg-surface text-ink text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-charcoal transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                                                                >
                                                                                    {savingGrade === sub.id ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />} {t('tasks.grade')}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            )}

                            {selected.outcomes && selected.outcomes.length > 0 && (
                                <div className="border-t border-brand-mist pt-4">
                                    <h4 className="text-xs font-black text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <ListChecks size={14} className="text-accent" /> {t('createCourse.outcomes_heading')}
                                    </h4>
                                    <ul className="space-y-2">
                                        {selected.outcomes.map((o, j) => (
                                            <li key={j} className="flex items-start gap-2 text-sm text-ink-subtle">
                                                <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                                <span>{pick(o, 'description')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </article>
                ) : (
                    <EmptyPanel icon={ListChecks} title={t('lessons.no_lesson_selected')} />
                )}
            </div>
        </div>
    );
}