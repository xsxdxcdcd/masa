"use client";

import { useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader, Plus, X } from 'lucide-react';

interface CalEvent {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    startsAt: string;
    endsAt: string;
    eventType: string;
}

interface EventForm {
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    eventType: string;
    startsAt: string;
    endsAt: string;
}

interface Props {
    openingId?: string;
}

const EVENT_TYPES = ['deadline', 'live_session', 'exam', 'other'] as const;

const EVENT_STYLES: Record<string, { dot: string; badge: string; ar: string; en: string }> = {
    deadline: { dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-800 dark:text-red-400 border-red-500/30', ar: 'موعد نهائي', en: 'Deadline' },
    live_session: { dot: 'bg-surface-raised', badge: 'bg-surface-raised text-blue-700 dark:text-blue-400 border-brand-navy-light/30', ar: 'جلسة مباشرة', en: 'Live session' },
    exam: { dot: 'bg-brand-gold-light', badge: 'bg-brand-gold/10 text-gold-ink border-brand-gold/30', ar: 'اختبار', en: 'Exam' },
    other: { dot: 'bg-gray-500', badge: 'bg-ink/[0.01] text-ink-muted border-line', ar: 'أخرى', en: 'Other' },
};

const eventStyle = (type: string) => EVENT_STYLES[type] || EVENT_STYLES.other;

const emptyEventForm: EventForm = {
    titleAr: '',
    titleEn: '',
    descriptionAr: '',
    descriptionEn: '',
    eventType: 'deadline',
    startsAt: '',
    endsAt: '',
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function AcademicCalendar({ openingId }: Props) {
    const { t, locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const { user } = useAuth();

    const canCreate = !!openingId && ['ADMIN', 'INSTRUCTOR', 'COURSE_MANAGER'].includes(user?.role || '');

    const { data, loading, error, refetch } = useFetchData<CalEvent[]>(openingId ? `/calendar/opening/${openingId}` : '/calendar/my');

    const today = new Date();
    const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<EventForm>(emptyEventForm);
    const [saving, setSaving] = useState(false);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalEvent[]>();
        (data || []).forEach((ev) => {
            const d = new Date(ev.startsAt);
            const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const arr = map.get(key) || [];
            arr.push(ev);
            map.set(key, arr);
        });
        map.forEach((arr) => arr.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
        return map;
    }, [data]);

    const cells = useMemo(() => {
        const firstDow = new Date(view.y, view.m, 1).getDay();
        const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
        const out: Array<number | null> = Array.from({ length: firstDow }, () => null);
        for (let d = 1; d <= daysInMonth; d++) out.push(d);
        while (out.length % 7 !== 0) out.push(null);
        return out;
    }, [view]);

    const dateKey = (d: number) => `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
    const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(isAr ? 'ar' : 'en-US', { month: 'long', year: 'numeric' });
    const weekdays = useMemo(() => {
        const base = new Date(2023, 9, 1); // a Sunday
        return Array.from({ length: 7 }, (_, i) =>
            new Date(base.getTime() + i * 86400000).toLocaleDateString(isAr ? 'ar' : 'en-US', { weekday: 'short' })
        );
    }, [isAr]);

    const prevMonth = () => setView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
    const nextMonth = () => setView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));

    const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : [];

    const saveEvent = async () => {
        if (!openingId) return;
        if (!form.titleAr.trim() || !form.titleEn.trim()) {
            toast.error(isAr ? 'أدخل العنوان بالعربي والإنجليزي' : 'Enter the title in Arabic and English');
            return;
        }
        if (!form.startsAt || !form.endsAt) {
            toast.error(isAr ? 'حدد وقت البداية والنهاية' : 'Set start and end times');
            return;
        }
        if (new Date(form.endsAt) <= new Date(form.startsAt)) {
            toast.error(isAr ? 'وقت النهاية يجب أن يكون بعد البداية' : 'End time must be after start time');
            return;
        }
        setSaving(true);
        try {
            await api.post(`/calendar/opening/${openingId}`, {
                titleAr: form.titleAr.trim(),
                titleEn: form.titleEn.trim(),
                descriptionAr: form.descriptionAr.trim() || undefined,
                descriptionEn: form.descriptionEn.trim() || undefined,
                eventType: form.eventType,
                startsAt: new Date(form.startsAt).toISOString(),
                endsAt: new Date(form.endsAt).toISOString(),
            });
            toast.success(isAr ? 'تم إنشاء الحدث' : 'Event created');
            setModalOpen(false);
            setForm(emptyEventForm);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const fmtTime = (iso: string) =>
        new Date(iso).toLocaleTimeString(isAr ? 'ar' : 'en-US', { hour: 'numeric', minute: '2-digit' });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="flex items-center gap-2 text-lg font-black text-ink">
                    <CalendarDays size={20} className="text-accent" />
                    {isAr ? 'التقويم الأكاديمي' : 'Academic Calendar'}
                </h3>
                {canCreate && (
                    <button
                        onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition"
                    >
                        <Plus size={16} /> {isAr ? 'حدث جديد' : 'New Event'}
                    </button>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
                {EVENT_TYPES.map((type) => {
                    const s = eventStyle(type);
                    return (
                        <span key={type} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-subtle">
                            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                            {isAr ? s.ar : s.en}
                        </span>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader size={28} className="animate-spin text-accent" />
                </div>
            ) : error ? (
                <div className="bg-surface-sunken border border-line rounded-2xl p-8 text-center">
                    <CalendarDays size={32} className="mx-auto text-ink-subtle mb-3" />
                    <p className="text-ink-subtle font-bold text-sm">{error}</p>
                </div>
            ) : (
                <div className="bg-surface-sunken border border-line rounded-2xl p-2 sm:p-5">
                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={prevMonth}
                            className="p-2 rounded-xl bg-ink/[0.04] border border-line text-ink-muted hover:text-ink hover:bg-ink/[0.08] transition"
                            aria-label={isAr ? 'الشهر السابق' : 'Previous month'}
                        >
                            {isAr ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                        <span className="text-ink font-black capitalize">{monthLabel}</span>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-xl bg-ink/[0.04] border border-line text-ink-muted hover:text-ink hover:bg-ink/[0.08] transition"
                            aria-label={isAr ? 'الشهر التالي' : 'Next month'}
                        >
                            {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                        </button>
                    </div>

                    {/* Weekday header */}
                    <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                        {weekdays.map((w) => (
                            <div key={w} className="text-center text-[10px] font-black uppercase tracking-wider text-ink-subtle py-1">
                                {w}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                        {cells.map((day, i) => {
                            if (day === null) return <div key={`blank-${i}`} />;
                            const key = dateKey(day);
                            const dayEvents = eventsByDate.get(key) || [];
                            const isToday =
                                view.y === today.getFullYear() && view.m === today.getMonth() && day === today.getDate();
                            const isSelected = selectedDate === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedDate(isSelected ? null : key)}
                                    className={`relative h-12 sm:h-20 rounded-xl border p-1.5 text-start transition-all ${
                                        isSelected
                                            ? 'border-brand-gold/50 bg-brand-gold/10'
                                            : isToday
                                              ? 'border-brand-gold/30 bg-ink/[0.024]'
                                              : 'border-line bg-ink/[0.02] hover:border-line hover:bg-ink/[0.04]'
                                    }`}
                                >
                                    <span className={`text-xs font-black tabular-nums ${isToday ? 'text-accent' : 'text-ink-muted'}`}>
                                        {day}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span className="absolute bottom-1.5 start-1.5 flex items-center gap-1">
                                            {dayEvents.slice(0, 3).map((ev) => (
                                                <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${eventStyle(ev.eventType).dot}`} />
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <span className="text-[9px] font-black text-ink-subtle">+{dayEvents.length - 3}</span>
                                            )}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected day details */}
                    {selectedDate && (
                        <div className="mt-4 pt-4 border-t border-line animate-fade-in">
                            <h4 className="text-sm font-black text-ink mb-3">
                                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(isAr ? 'ar' : 'en-US', {
                                    weekday: 'long', month: 'long', day: 'numeric',
                                })}
                            </h4>
                            {selectedEvents.length === 0 ? (
                                <p className="text-xs text-ink-subtle font-bold">{isAr ? 'لا توجد أحداث في هذا اليوم' : 'No events on this day'}</p>
                            ) : (
                                <div className="space-y-2">
                                    {selectedEvents.map((ev) => (
                                        <div key={ev.id} className="bg-ink/[0.02] border border-line rounded-xl p-3.5">
                                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                                <div className="min-w-0">
                                                    <p className="text-ink text-sm font-bold">{pick(ev, 'title')}</p>
                                                    {pick(ev, 'description') && (
                                                        <p className="text-ink-subtle text-xs mt-1 leading-relaxed whitespace-pre-wrap break-words">{pick(ev, 'description')}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${eventStyle(ev.eventType).badge}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${eventStyle(ev.eventType).dot}`} />
                                                        {isAr ? eventStyle(ev.eventType).ar : eventStyle(ev.eventType).en}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-subtle tabular-nums">
                                                        <Clock size={11} />
                                                        {fmtTime(ev.startsAt)}{ev.endsAt ? ` – ${fmtTime(ev.endsAt)}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {modalOpen && openingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
                    <div
                        className="bg-surface border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-line">
                            <h3 className="text-lg font-black text-ink">{isAr ? 'حدث تقويم جديد' : 'New Calendar Event'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-ink-subtle hover:text-ink transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'العنوان بالعربي' : 'Title (Arabic)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleAr}
                                        onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'العنوان بالإنجليزي' : 'Title (English)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleEn}
                                        onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'الوصف بالعربي (اختياري)' : 'Description (Arabic, optional)'}</label>
                                    <textarea
                                        value={form.descriptionAr}
                                        onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                                        rows={2}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'الوصف بالإنجليزي (اختياري)' : 'Description (English, optional)'}</label>
                                    <textarea
                                        value={form.descriptionEn}
                                        onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                                        rows={2}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-ink placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'نوع الحدث' : 'Event type'}</label>
                                    <select
                                        value={form.eventType}
                                        onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-sm text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-gold/50 [&>option]:bg-surface"
                                    >
                                        {EVENT_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                                {isAr ? eventStyle(type).ar : eventStyle(type).en}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'يبدأ' : 'Starts at'}</label>
                                    <input
                                        type="datetime-local"
                                        value={form.startsAt}
                                        onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-gold/50 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ink-muted mb-1.5">{isAr ? 'ينتهي' : 'Ends at'}</label>
                                    <input
                                        type="datetime-local"
                                        value={form.endsAt}
                                        onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-ink/[0.04] border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-gold/50 [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-line">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-all"
                            >
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={saveEvent}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <Loader size={14} className="animate-spin" />}
                                {isAr ? 'إنشاء' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
