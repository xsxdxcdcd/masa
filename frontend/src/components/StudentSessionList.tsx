"use client";

import { Video, Clock, CalendarDays, Link2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

export interface StudentLiveSession {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    scheduledAt: string;
    durationMinutes?: number | null;
    /** Already resolved by the backend; null means there is no room to join. */
    meetLink?: string | null;
    /** False when the link was inherited from the batch rather than its own. */
    hasOwnLink?: boolean;
}

/**
 * The read-only side of the batch's meeting schedule.
 *
 * The links it renders arrive already gated by the backend on APPROVED +
 * ONLINE, so this component never decides who may join -- it only shows what it
 * was given. That is the point of rendering `meetLink` per session instead of
 * one batch-level button: a session with its own room and a session that
 * inherits the batch room are different facts, and a student can see which is
 * which before the class starts.
 */
export default function StudentSessionList({
    sessions,
    limit,
    emptyHint,
}: {
    sessions?: StudentLiveSession[] | null;
    /** Show only this many of the soonest upcoming sessions. */
    limit?: number;
    /** Shown when there is nothing to list; omit to render nothing at all. */
    emptyHint?: string;
}) {
    const { t, pick, locale } = useI18n();
    const isAr = locale === 'ar';

    const all = (sessions || [])
        .map((s) => ({ s, at: new Date(s.scheduledAt).getTime() }))
        .filter((row) => !Number.isNaN(row.at))
        .sort((a, b) => a.at - b.at);

    const now = Date.now();
    const upcoming = all.filter((row) => (row.s.durationMinutes
        ? row.at + row.s.durationMinutes * 60000
        : row.at) >= now);

    const shown = (limit ? upcoming.slice(0, limit) : all).map((row) => row.s);
    if (shown.length === 0) {
        if (!emptyHint) return null;
        return (
            <div className="flex items-start gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <CalendarDays size={14} className="mt-0.5 shrink-0 text-gray-500" />
                <span>{emptyHint}</span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {shown.map((s) => {
                const startsAt = new Date(s.scheduledAt);
                const endsAt = s.durationMinutes
                    ? new Date(startsAt.getTime() + s.durationMinutes * 60000)
                    : null;
                const live = startsAt.getTime() <= now && (!endsAt || endsAt.getTime() >= now);
                const finished = !!endsAt && endsAt.getTime() < now;
                const time = (d: Date) => d.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: 'numeric', minute: '2-digit' });

                return (
                    <div
                        key={s.id}
                        className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                            live ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'
                        }`}
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                                {pick(s, 'title') || s.titleEn || s.titleAr}
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                                <span className="inline-flex items-center gap-1">
                                    <CalendarDays size={12} />
                                    {startsAt.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                                        weekday: 'short', month: 'short', day: 'numeric',
                                    })}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Clock size={12} />
                                    {time(startsAt)}{endsAt ? ` — ${time(endsAt)}` : ''}
                                </span>
                                {s.durationMinutes ? (
                                    <span>{t('liveSessions.minutes').replace('{n}', String(s.durationMinutes))}</span>
                                ) : null}
                                {live ? (
                                    <span className="font-bold text-emerald-400">{t('liveSessions.live_now')}</span>
                                ) : finished ? (
                                    <span className="text-gray-500">{t('liveSessions.ended')}</span>
                                ) : null}
                            </p>
                        </div>

                        {s.meetLink ? (
                            <a
                                href={s.meetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 shrink-0 text-xs font-bold px-3 py-2 rounded-lg border transition ${
                                    live
                                        ? 'bg-emerald-500 text-brand-navy-dark border-emerald-400 hover:bg-emerald-400'
                                        : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20'
                                }`}
                            >
                                <Video size={14} /> {t('liveSessions.join')}
                            </a>
                        ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500">
                                <Link2 size={12} />
                                {s.hasOwnLink === false
                                    ? t('liveSessions.uses_batch_link')
                                    : t('liveSessions.no_link_yet')}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
