"use client";

import { useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { CheckCircle2, ClipboardCheck, Loader, MessageSquareQuote, Send, Users } from 'lucide-react';

interface Criterion {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    maxScore: number;
    orderIndex?: number;
}

interface CriterionScoreData {
    criterionId: string;
    score: number;
    commentAr?: string | null;
    commentEn?: string | null;
}

interface ReviewData {
    id: string;
    commentAr?: string | null;
    commentEn?: string | null;
    createdAt: string;
    reviewer?: { id: string; email?: string } | null;
    criterionScores?: CriterionScoreData[];
}

interface RubricData {
    id: string;
    titleAr: string;
    titleEn: string;
    criteria?: Criterion[];
    reviews?: ReviewData[];
}

interface Props {
    taskId: string;
    submissionId: string;
    rubricId?: string;
}

export default function PeerReviewPanel({ taskId, submissionId, rubricId }: Props) {
    const { t, locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const { user } = useAuth();

    const { data: rubric, loading, error, refetch } = useFetchData<RubricData>(
        rubricId ? `/rubrics/${rubricId}` : `/rubrics/task/${taskId}`
    );

    const [scores, setScores] = useState<Record<string, number>>({});
    const [comments, setComments] = useState<Record<string, string>>({});
    const [overall, setOverall] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [initializedFor, setInitializedFor] = useState<string | null>(null);

    const criteria = useMemo(
        () => [...(rubric?.criteria || [])].sort((a, b) => Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0)),
        [rubric]
    );
    const reviews = rubric?.reviews || [];
    const myReview = reviews.find((r) => r.reviewer?.id === user?.userId) || null;

    // Prefill the form from my existing review (update mode)
    useEffect(() => {
        if (!rubric || initializedFor === rubric.id) return;
        setInitializedFor(rubric.id);
        if (myReview) {
            const s: Record<string, number> = {};
            const c: Record<string, string> = {};
            (myReview.criterionScores || []).forEach((cs) => {
                s[cs.criterionId] = Number(cs.score || 0);
                c[cs.criterionId] = (isAr ? cs.commentAr : cs.commentEn) || cs.commentAr || cs.commentEn || '';
            });
            setScores(s);
            setComments(c);
            setOverall((isAr ? myReview.commentAr : myReview.commentEn) || myReview.commentAr || myReview.commentEn || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rubric, myReview]);

    const totalMax = criteria.reduce((s, c) => s + Number(c.maxScore || 0), 0);
    const totalGiven = criteria.reduce((s, c) => s + Number(scores[c.id] ?? 0), 0);

    // Received reviews summary: average score per criterion
    const summary = useMemo(() => {
        return criteria.map((c) => {
            const all = reviews.flatMap((r) => r.criterionScores || []).filter((cs) => cs.criterionId === c.id);
            const avg = all.length ? all.reduce((s, cs) => s + Number(cs.score || 0), 0) / all.length : null;
            return { criterion: c, avg, count: all.length };
        });
    }, [criteria, reviews]);

    const submitReview = async () => {
        if (!rubric) return;
        const missing = criteria.filter((c) => scores[c.id] === undefined);
        if (missing.length > 0) {
            toast.error(isAr
                ? `قيّم جميع المعايير (${missing.length} متبقٍ)`
                : `Score all criteria (${missing.length} remaining)`);
            return;
        }
        const outOfRange = criteria.find((c) => Number(scores[c.id]) < 0 || Number(scores[c.id]) > Number(c.maxScore));
        if (outOfRange) {
            toast.error(isAr ? 'هناك درجة خارج النطاق المسموح' : 'A score is outside the allowed range');
            return;
        }
        setSubmitting(true);
        try {
            await api.post(`/rubrics/${rubric.id}/review`, {
                submissionId,
                commentAr: overall.trim() || undefined,
                commentEn: overall.trim() || undefined,
                criterionScores: criteria.map((c) => ({
                    criterionId: c.id,
                    score: Number(scores[c.id]),
                    commentAr: comments[c.id]?.trim() || undefined,
                    commentEn: comments[c.id]?.trim() || undefined,
                })),
            });
            toast.success(myReview
                ? (isAr ? 'تم تحديث مراجعتك' : 'Your review was updated')
                : (isAr ? 'تم إرسال مراجعتك، شكراً!' : 'Review submitted, thank you!'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader size={28} className="animate-spin text-accent" />
            </div>
        );
    }

    if (error || !rubric) {
        return (
            <div className="bg-surface-sunken border border-line rounded-2xl p-8 text-center">
                <ClipboardCheck size={32} className="mx-auto text-ink-subtle mb-3" />
                <p className="text-ink-subtle font-bold text-sm">{error || (isAr ? 'لا توجد سلسلة تقييم لهذه المهمة' : 'No rubric found for this task')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="flex items-center gap-2 text-lg font-black text-ink">
                    <ClipboardCheck size={20} className="text-accent" />
                    {pick(rubric, 'title') || (isAr ? 'تقييم الأقران' : 'Peer Review')}
                </h3>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-subtle">
                    <Users size={13} />
                    {reviews.length} {isAr ? 'مراجعة' : reviews.length === 1 ? 'review' : 'reviews'}
                </span>
            </div>

            {/* ===== My review form ===== */}
            <div className="bg-surface-sunken border border-line rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-sm font-black text-ink">
                        {myReview ? (isAr ? 'تعديل مراجعتك' : 'Update your review') : (isAr ? 'مراجعتك' : 'Your review')}
                    </h4>
                    <span className={`px-3 py-1 rounded-lg text-xs font-black tabular-nums ${
                        totalGiven >= totalMax / 2
                            ? 'bg-brand-gold/10 text-gold-ink border border-brand-gold/30'
                            : 'bg-red-500/10 text-red-800 dark:text-red-400 border border-red-500/30'
                    }`}>
                        {totalGiven} / {totalMax}
                    </span>
                </div>

                {criteria.length === 0 ? (
                    <p className="text-ink-subtle font-bold text-xs text-center py-6">{isAr ? 'لا توجد معايير في سلسلة التقييم' : 'This rubric has no criteria'}</p>
                ) : (
                    <div className="space-y-4">
                        {criteria.map((c, i) => {
                            const val = scores[c.id];
                            const max = Math.max(1, Number(c.maxScore || 10));
                            return (
                                <div key={c.id} className="bg-ink/[0.02] border border-line rounded-xl p-4">
                                    <div className="flex items-start justify-between gap-3 mb-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-ink-muted leading-snug">
                                                {i + 1}. {pick(c, 'title')}
                                            </p>
                                            {pick(c, 'description') && (
                                                <p className="text-[11px] text-ink-subtle mt-1 leading-relaxed">{pick(c, 'description')}</p>
                                            )}
                                        </div>
                                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-black tabular-nums ${
                                            val === undefined
                                                ? 'bg-ink/[0.04] text-gold-ink'
                                                : 'bg-brand-gold/10 text-gold-ink'
                                        }`}>
                                            {val === undefined ? `? / ${max}` : `${val} / ${max}`}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={max}
                                        step={1}
                                        value={val ?? 0}
                                        onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                                        className="w-full accent-brand-gold cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={comments[c.id] || ''}
                                        onChange={(e) => setComments((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                        placeholder={isAr ? `تعليق على "${pick(c, 'title')}" (اختياري)...` : `Comment on "${pick(c, 'title')}" (optional)...`}
                                        className="mt-2.5 w-full px-3 py-2 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                <div>
                    <label className="flex items-center gap-1.5 text-sm font-bold text-ink-muted mb-1.5">
                        <MessageSquareQuote size={14} className="text-accent" />
                        {isAr ? 'تعليق عام' : 'Overall comment'}
                    </label>
                    <textarea
                        value={overall}
                        onChange={(e) => setOverall(e.target.value)}
                        rows={3}
                        placeholder={isAr ? 'رأيك العام في هذا العمل...' : 'Your overall feedback on this submission...'}
                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                    />
                </div>

                <button
                    onClick={submitReview}
                    disabled={submitting || criteria.length === 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-black bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition disabled:opacity-50"
                >
                    {submitting ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                    {myReview ? (isAr ? 'تحديث المراجعة' : 'Update review') : (isAr ? 'إرسال المراجعة' : 'Submit review')}
                </button>
            </div>

            {/* ===== Received reviews summary ===== */}
            {reviews.length > 0 && (
                <div className="bg-surface-sunken border border-line rounded-2xl p-5 space-y-5">
                    <h4 className="text-sm font-black text-ink">{isAr ? 'ملخص المراجعات المستلمة' : 'Received reviews summary'}</h4>

                    <div className="space-y-3.5">
                        {summary.map(({ criterion, avg, count }) => {
                            const max = Math.max(1, Number(criterion.maxScore || 10));
                            const pct = avg !== null ? Math.round((avg / max) * 100) : 0;
                            return (
                                <div key={criterion.id}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-ink-muted truncate">{pick(criterion, 'title')}</span>
                                        <span className="text-[11px] font-black text-ink-subtle tabular-nums shrink-0 ms-2">
                                            {avg !== null ? `${avg.toFixed(1)} / ${max}` : '—'}
                                            <span className="text-ink-subtle font-bold ms-1.5">({count})</span>
                                        </span>
                                    </div>
                                    <div className="h-2.5 bg-ink/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-brand-gold-dark to-brand-gold-light transition-all duration-700"
                                            style={{ width: `${Math.max(2, pct)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-2.5 pt-1">
                        {reviews.map((r) => (
                            <div key={r.id} className="bg-ink/[0.02] border border-line rounded-xl p-3.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                                    <span className="text-xs font-bold text-ink-muted truncate">
                                        {r.reviewer?.email || (isAr ? 'مراجع' : 'Reviewer')}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-subtle shrink-0">
                                        <CheckCircle2 size={11} className="text-green-700 dark:text-green-400" />
                                        {new Date(r.createdAt).toLocaleDateString(isAr ? 'ar' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                {pick(r, 'comment') && (
                                    <p className="text-xs text-ink-subtle leading-relaxed whitespace-pre-wrap">{pick(r, 'comment')}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
