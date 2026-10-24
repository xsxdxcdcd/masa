"use client";

import { useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { Loader, Star, User } from 'lucide-react';

interface RatingItem {
    id: string;
    rating: number;
    commentAr?: string | null;
    commentEn?: string | null;
    createdAt: string;
    user?: { id: string; email?: string } | null;
}

interface Props {
    instructorId: string;
    courseId: string;
    showRateButton?: boolean;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    size={size}
                    className={i <= Math.round(value) ? 'fill-brand-gold-light text-brand-gold-light' : 'text-ink-on-navy-subtle'}
                />
            ))}
        </div>
    );
}

export default function InstructorRating({ instructorId, courseId, showRateButton = false }: Props) {
    const { t, locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const { user } = useAuth();

    const ratingsRes = useFetchData<unknown>(`/ratings/course/${courseId}`);
    const enrollRes = useFetchData<Array<{ course?: { id: string } }>>(showRateButton ? '/enrollments/my' : null);

    const [formOpen, setFormOpen] = useState(false);
    const [hover, setHover] = useState(0);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    const { items, avg } = useMemo(() => {
        const raw: unknown = ratingsRes.data;
        const rawObj = raw as { ratings?: RatingItem[]; average?: number } | null;
        const list: RatingItem[] = Array.isArray(raw)
            ? (raw as RatingItem[])
            : (rawObj?.ratings ?? []);
        const computedAvg = list.length
            ? list.reduce((s, r) => s + Number(r.rating || 0), 0) / list.length
            : Number(rawObj?.average ?? 0);
        return { items: list, avg: computedAvg };
    }, [ratingsRes.data]);

    const isEnrolled = useMemo(
        () => (enrollRes.data || []).some((e) => e.course?.id === courseId),
        [enrollRes.data, courseId]
    );
    const myRating = useMemo(
        () => items.find((r) => r.user?.id === user?.userId) || null,
        [items, user?.userId]
    );
    const canRate = !!showRateButton && isEnrolled && user?.role === 'STUDENT';

    const openForm = () => {
        setRating(myRating?.rating || 0);
        setComment(pick(myRating, 'comment') || '');
        setFormOpen(true);
    };

    const submit = async () => {
        if (rating < 1) {
            toast.error(isAr ? 'اختر تقييماً من ١ إلى ٥ نجوم' : 'Select a rating from 1 to 5 stars');
            return;
        }
        setSaving(true);
        try {
            const text = comment.trim();
            await api.post(`/ratings/course/${courseId}`, {
                instructorId,
                rating,
                commentAr: text || undefined,
                commentEn: text || undefined,
            });
            toast.success(myRating
                ? (isAr ? 'تم تحديث تقييمك' : 'Your rating was updated')
                : (isAr ? 'شكراً لتقييمك!' : 'Thanks for your rating!'));
            setFormOpen(false);
            ratingsRes.refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="text-center">
                    <div className="text-5xl font-black text-white tabular-nums">{avg > 0 ? avg.toFixed(1) : '—'}</div>
                    <div className="mt-1.5"><Stars value={avg} size={16} /></div>
                    <p className="text-[11px] text-ink-on-navy-muted font-bold mt-1.5">
                        {items.length} {isAr ? (items.length === 1 ? 'تقييم' : 'تقييمات') : items.length === 1 ? 'rating' : 'ratings'}
                    </p>
                </div>
                <div className="hidden sm:block w-px self-stretch bg-white/5" />
                {canRate ? (
                    <div className="sm:ms-auto">
                        {formOpen ? (
                            <div className="w-full sm:w-96 space-y-3 bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                <p className="text-sm font-black text-white">
                                    {myRating ? (isAr ? 'تعديل تقييمك' : 'Update your rating') : (isAr ? 'قيّم هذا المحاضر' : 'Rate this instructor')}
                                </p>
                                <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onMouseEnter={() => setHover(i)}
                                            onClick={() => setRating(i)}
                                            className="transition-transform hover:scale-110"
                                            aria-label={`${i} / 5`}
                                        >
                                            <Star
                                                size={28}
                                                className={(hover || rating) >= i
                                                    ? 'fill-brand-gold-light text-brand-gold-light'
                                                    : 'text-ink-on-navy-subtle'}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                    placeholder={isAr ? 'تعليق (اختياري)...' : 'Comment (optional)...'}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-ink-on-navy-subtle text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => setFormOpen(false)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-on-navy-muted hover:text-white hover:bg-white/5 transition"
                                    >
                                        {isAr ? 'إلغاء' : 'Cancel'}
                                    </button>
                                    <button
                                        onClick={submit}
                                        disabled={saving}
                                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition disabled:opacity-50"
                                    >
                                        {saving && <Loader size={12} className="animate-spin" />}
                                        {myRating ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إرسال' : 'Submit')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center sm:text-start">
                                {myRating && (
                                    <p className="text-xs font-bold text-ink-on-navy-muted mb-2">
                                        {isAr ? 'تقييمك الحالي:' : 'Your current rating:'} <Stars value={myRating.rating} />
                                    </p>
                                )}
                                <button
                                    onClick={openForm}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition"
                                >
                                    <Star size={14} className={myRating ? 'fill-brand-navy-dark' : ''} />
                                    {myRating ? (isAr ? 'تعديل تقييمك' : 'Update your rating') : (isAr ? 'قيّم هذا المحاضر' : 'Rate this instructor')}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="sm:ms-auto text-xs text-ink-on-navy-muted font-bold">
                        {avg <= 0 ? (isAr ? 'لا توجد تقييمات بعد' : 'No ratings yet') : ''}
                    </p>
                )}
            </div>

            {items.length > 0 && (
                <div className="space-y-2.5">
                    {items.map((r) => (
                        <div key={r.id} className="bg-brand-navy-dark border border-white/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        <User size={16} className="text-ink-on-navy-muted" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-white text-sm font-bold truncate">{r.user?.email || (isAr ? 'طالب' : 'Student')}</p>
                                        <p className="text-[11px] text-ink-on-navy-muted font-bold">
                                            {new Date(r.createdAt).toLocaleDateString(isAr ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <Stars value={Number(r.rating)} />
                            </div>
                            {pick(r, 'comment') && (
                                <p className="text-ink-on-navy-muted text-sm mt-3 leading-relaxed whitespace-pre-wrap">{pick(r, 'comment')}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
