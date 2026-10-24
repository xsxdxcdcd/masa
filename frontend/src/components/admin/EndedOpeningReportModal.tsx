'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
    X, BookOpen, Users, Award, Search, CreditCard,
    AlertTriangle, Printer, Info, Clock,
} from 'lucide-react';
import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { Badge, type Tone } from '@/app/dashboard/admin/components';

type EnrollmentStatus = 'PENDING' | 'APPROVED' | 'RESERVED' | 'REJECTED' | 'REVOKED';
type CertStatus = 'VALID' | 'REVOKED' | 'EXPIRED';

const ALL_STATUSES: EnrollmentStatus[] = ['APPROVED', 'RESERVED', 'PENDING', 'REJECTED', 'REVOKED'];

const ENROLLMENT_TONE: Record<EnrollmentStatus, Tone> = {
    APPROVED: 'green',
    RESERVED: 'amber',
    PENDING: 'blue',
    REJECTED: 'red',
    REVOKED: 'gray',
};

const CERT_TONE: Record<CertStatus, Tone> = {
    VALID: 'green',
    REVOKED: 'red',
    EXPIRED: 'gray',
};

const PAYMENT_TONE: Record<string, Tone> = {
    PAID: 'green',
    PENDING: 'amber',
    REJECTED: 'red',
    REFUNDED: 'purple',
    FAILED: 'red',
    CANCELLED: 'gray',
};

interface RosterEntry {
    id: string;
    status: EnrollmentStatus;
    createdAt: string;
    student: { id: string; email: string };
    payment: { id: string; status: string; amount?: string | null; paidAt?: string | null } | null;
}

interface RosterResponse {
    opening: {
        id: string;
        status: string;
        nameAr?: string | null;
        nameEn?: string | null;
        price: string;
        startDate?: string | null;
        endDate?: string | null;
        course: { titleAr?: string | null; titleEn?: string | null };
    };
    counts: Record<EnrollmentStatus, number>;
    total: number;
    enrollments: RosterEntry[];
}

interface CertRecord {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: CertStatus;
    student: { id: string; email: string };
    printedAt?: string | null;
    printedBy?: { id: string; email: string } | null;
}

interface CertResponse {
    course: { id: string; titleAr?: string | null; titleEn?: string | null; certificateIssued: boolean };
    counts: Record<CertStatus, number>;
    total: number;
    printed?: number;
    certificates: CertRecord[];
}

interface CourseDetail {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    categoryAr?: string | null;
    categoryEn?: string | null;
    level?: string | null;
    language?: string | null;
    hoursOfContent?: number | null;
    certificateIssued?: boolean | null;
    instructor?: { id: string; email: string } | null;
    _count?: { enrollments?: number; modules?: number };
}

type Tab = 'course' | 'students' | 'certificates';

const fmtNum = (n: number) => n.toLocaleString('en-US');
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

/** Label/value line. Declared at module level so it is not re-created per render. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
            <span className="text-xs text-gray-400 shrink-0">{label}</span>
            <span className="text-sm font-bold text-white text-end break-words">{value}</span>
        </div>
    );
}

/**
 * Wrap-up for a finished batch: what the course was, who actually turned up,
 * and which certificates went out — including the ones already released on
 * paper. Issuing and revoking stay in the certificate approval modal so there
 * is one place that can hand out credentials; the only write here is logging
 * that a printed copy changed hands.
 */
export default function EndedOpeningReportModal({
    openingId,
    courseId,
    onClose,
}: {
    openingId: string;
    courseId: string;
    onClose: () => void;
}) {
    const { t, pick } = useI18n();
    const [tab, setTab] = useState<Tab>('course');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | EnrollmentStatus>('ALL');
    const [markingId, setMarkingId] = useState<string | null>(null);

    const course = useFetchData<CourseDetail>(`/courses/${courseId}`);
    const roster = useFetchData<RosterResponse>(`/enrollments/opening/${openingId}`);
    const certs = useFetchData<CertResponse>(`/certificates/course/${courseId}`);

    const needle = query.trim().toLowerCase();
    const match = (email: string) => !needle || email.toLowerCase().includes(needle);

    const students = (roster.data?.enrollments ?? [])
        .filter(e => statusFilter === 'ALL' || e.status === statusFilter)
        .filter(e => match(e.student.email));

    const certificates = (certs.data?.certificates ?? []).filter(c => match(c.student.email));

    // Recording a print writes through the API and then refetches, so the row
    // shows the server's timestamp and printer rather than a local guess.
    const markPrinted = async (certificateId: string) => {
        setMarkingId(certificateId);
        try {
            await api.post(`/certificates/${certificateId}/print`);
            toast.success(t('report.cert_printed_recorded'));
            certs.refetch();
        } catch (e) {
            toast.error(getErrorMessage(e) || t('common.error'));
        } finally {
            setMarkingId(null);
        }
    };

    const approved = roster.data?.counts?.APPROVED ?? 0;
    const certTotal = certs.data?.total ?? 0;
    // Students entitled to a certificate but who never got one.
    const missingCert = Math.max(0, approved - certTotal);

    const tabs: { key: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
        { key: 'course', label: t('report.tab_course'), icon: BookOpen },
        { key: 'students', label: t('report.tab_students'), icon: Users, count: roster.data?.total },
        { key: 'certificates', label: t('report.tab_certificates'), icon: Award, count: certTotal },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="bg-brand-navy border border-white/10 rounded-2xl w-full max-w-4xl shadow-xl animate-fade-in-up max-h-[88vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-3 p-6 pb-4 border-b border-white/10">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-black text-white truncate">
                                {pick(roster.data?.opening, 'name') || t('report.ended_title')}
                            </h3>
                            <Badge tone="gray" dot>{t('statuses.ended')}</Badge>
                        </div>
                        <p className="text-sm text-gray-400 mt-1 truncate">
                            {pick(course.data, 'title') || t('common.loading')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href={`/dashboard/courses/open/${courseId}?edit=${openingId}`}
                            className="hidden sm:inline-flex text-xs font-bold px-3 py-2 rounded-xl border border-white/10 text-white hover:border-brand-gold hover:text-brand-gold-light transition"
                        >
                            {t('manageCourses.edit_opening_tooltip')}
                        </Link>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition cursor-pointer"
                            aria-label={t('common.close')}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4 border-b border-white/10 overflow-x-auto">
                    {tabs.map(({ key, label, icon: Icon, count }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition ${
                                tab === key
                                    ? 'border-brand-gold text-brand-gold-light'
                                    : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                        >
                            <Icon size={16} />
                            {label}
                            {count != null && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-white/10 text-gray-300">
                                    {fmtNum(count)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* ---------- Course ---------- */}
                    {tab === 'course' && (
                        course.loading ? (
                            <p className="admin-card p-5 text-sm text-gray-400">{t('common.loading')}</p>
                        ) : course.error ? (
                            <p className="p-4 text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl text-sm">{course.error}</p>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="admin-card p-4">
                                        <h4 className="text-sm font-black text-white mb-2 flex items-center gap-2">
                                            <Info size={16} className="text-brand-gold" /> {t('report.course_section')}
                                        </h4>
                                        <InfoRow label={t('admin.col_title')} value={pick(course.data, 'title') || '—'} />
                                        <InfoRow
                                            label={t('admin.col_category')}
                                            value={pick(course.data, 'category') || '—'}
                                        />
                                        <InfoRow
                                            label={t('admin.col_level')}
                                            value={course.data?.level
                                                ? t(`course.level_${course.data.level.toLowerCase()}`)
                                                : '—'}
                                        />
                                        <InfoRow label={t('admin.col_language')} value={course.data?.language || '—'} />
                                        <InfoRow
                                            label={t('admin.col_hours')}
                                            value={course.data?.hoursOfContent != null ? fmtNum(course.data.hoursOfContent) : '—'}
                                        />
                                        <InfoRow
                                            label={t('report.instructor_label')}
                                            value={course.data?.instructor?.email || '—'}
                                        />
                                        <InfoRow
                                            label={t('report.modules_label')}
                                            value={fmtNum(course.data?._count?.modules ?? 0)}
                                        />
                                        <InfoRow
                                            label={t('report.certificates_enabled')}
                                            value={course.data?.certificateIssued ? t('common.yes') : t('common.no')}
                                        />
                                    </div>

                                    <div className="admin-card p-4">
                                        <h4 className="text-sm font-black text-white mb-2 flex items-center gap-2">
                                            <Clock size={16} className="text-brand-gold" /> {t('report.opening_section')}
                                        </h4>
                                        <InfoRow
                                            label={t('report.dates_label')}
                                            value={`${fmtDate(roster.data?.opening?.startDate)} → ${fmtDate(roster.data?.opening?.endDate)}`}
                                        />
                                        <InfoRow label={t('admin.col_price')} value={`$${roster.data?.opening?.price ?? '—'}`} />
                                        <InfoRow
                                            label={t('report.approved_label')}
                                            value={<span className="text-emerald-400">{fmtNum(approved)}</span>}
                                        />
                                        <InfoRow
                                            label={t('report.reserved_label')}
                                            value={<span className="text-amber-400">{fmtNum(roster.data?.counts?.RESERVED ?? 0)}</span>}
                                        />
                                        <InfoRow
                                            label={t('report.total_enrollments')}
                                            value={fmtNum(roster.data?.total ?? 0)}
                                        />
                                        <InfoRow
                                            label={t('report.cert_issued_count')}
                                            value={<span className="text-brand-gold-light">{fmtNum(certTotal)}</span>}
                                        />
                                    </div>
                                </div>

                                {(pick(course.data, 'description')) && (
                                    <div className="admin-card p-4">
                                        <h4 className="text-sm font-black text-white mb-2">{t('report.description_label')}</h4>
                                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                                            {pick(course.data, 'description')}
                                        </p>
                                    </div>
                                )}

                                <div className="p-3 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-400 flex items-start gap-2">
                                    <Printer size={16} className="shrink-0 mt-0.5" />
                                    <span>{t('report.print_notice')}</span>
                                </div>
                            </div>
                        )
                    )}

                    {/* ---------- Students ---------- */}
                    {tab === 'students' && (
                        roster.loading ? (
                            <p className="admin-card p-5 text-sm text-gray-400">{t('common.loading')}</p>
                        ) : roster.error ? (
                            <p className="p-4 text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl text-sm">{roster.error}</p>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('ALL')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${statusFilter === 'ALL'
                                            ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black'
                                            : 'bg-white/5 text-gray-400 border border-white/10'}`}
                                    >
                                        {t('admin.filter_all')} · {fmtNum(roster.data?.total ?? 0)}
                                    </button>
                                    {ALL_STATUSES.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatusFilter(s)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${statusFilter === s
                                                ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black'
                                                : 'bg-white/5 text-gray-400 border border-white/10'}`}
                                        >
                                            {t(`statuses.${s.toLowerCase()}`)} · {fmtNum(roster.data?.counts?.[s] ?? 0)}
                                        </button>
                                    ))}
                                </div>

                                {students.length === 0 ? (
                                    <p className="admin-card p-5 text-sm text-gray-500 dark:text-gray-400">
                                        {(roster.data?.total ?? 0) === 0 ? t('roster.no_students') : t('admin.panel_no_match')}
                                    </p>
                                ) : (
                                    <div className="admin-table-wrap">
                                        <table className="admin-table text-left">
                                            <thead>
                                                <tr>
                                                    <th>{t('admin.col_email')}</th>
                                                    <th>{t('roster.col_status')}</th>
                                                    <th>{t('admin.panel_payment')}</th>
                                                    <th>{t('report.certificate_col')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {students.map(e => {
                                                    const held = (certs.data?.certificates ?? [])
                                                        .find(c => c.student.id === e.student.id);
                                                    return (
                                                        <tr key={e.id} className="text-sm">
                                                            <td className="p-3.5 font-bold text-brand-navy dark:text-gray-200" dir="ltr">
                                                                {e.student.email}
                                                            </td>
                                                            <td className="p-3.5">
                                                                <Badge tone={ENROLLMENT_TONE[e.status]} dot>
                                                                    {t(`statuses.${e.status.toLowerCase()}`)}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-3.5">
                                                                {e.payment ? (
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <Badge tone={PAYMENT_TONE[e.payment.status] ?? 'gray'} dot>
                                                                            {t(`statuses.${e.payment.status.toLowerCase()}`)}
                                                                        </Badge>
                                                                        <span className="font-bold text-white">${e.payment.amount}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                                                        <CreditCard size={14} /> {t('admin.panel_no_payment')}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3.5">
                                                                {held ? (
                                                                    <Badge tone={CERT_TONE[held.verificationStatus]} dot>
                                                                        {t(`certStatus.${held.verificationStatus.toLowerCase()}`)}
                                                                    </Badge>
                                                                ) : e.status === 'APPROVED' ? (
                                                                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                                                                        <AlertTriangle size={14} /> {t('report.cert_missing')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-600">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )
                    )}

                    {/* ---------- Certificates ---------- */}
                    {tab === 'certificates' && (
                        certs.loading ? (
                            <p className="admin-card p-5 text-sm text-gray-400">{t('common.loading')}</p>
                        ) : certs.error ? (
                            <p className="p-4 text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl text-sm">{certs.error}</p>
                        ) : (
                            <>
                                {missingCert > 0 && (
                                    <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-amber-300 flex items-start gap-2">
                                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                        <span>{t('report.cert_missing_count').replace('{n}', fmtNum(missingCert))}</span>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(['VALID', 'REVOKED', 'EXPIRED'] as CertStatus[]).map(s => (
                                        <Badge key={s} tone={CERT_TONE[s]} dot>
                                            {t(`certStatus.${s.toLowerCase()}`)} · {fmtNum(certs.data?.counts?.[s] ?? 0)}
                                        </Badge>
                                    ))}
                                    <Badge tone="gold" dot>
                                        {t('report.cert_printed_count').replace('{n}', fmtNum(certs.data?.printed ?? 0))}
                                    </Badge>
                                </div>

                                <div className="relative mb-4">
                                    <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder={t('admin.panel_search_students')}
                                        className="ps-9 pe-3 py-2.5 w-full sm:w-72 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                                    />
                                </div>

                                {certificates.length === 0 ? (
                                    <p className="admin-card p-5 text-sm text-gray-500 dark:text-gray-400">
                                        {(certs.data?.total ?? 0) === 0 ? t('report.no_certificates') : t('admin.panel_no_match')}
                                    </p>
                                ) : (
                                    <div className="admin-table-wrap">
                                        <table className="admin-table text-left">
                                            <thead>
                                                <tr>
                                                    <th>{t('report.cert_holder')}</th>
                                                    <th>{t('report.certificate_col')}</th>
                                                    <th>{t('report.cert_issued_on')}</th>
                                                    <th>{t('report.cert_printed_col')}</th>
                                                    <th>{t('report.cert_code')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {certificates.map(c => (
                                                    <tr key={c.id} className="text-sm">
                                                        <td className="p-3.5 font-bold text-brand-navy dark:text-gray-200" dir="ltr">
                                                            {c.student.email}
                                                        </td>
                                                        <td className="p-3.5">
                                                            <Badge tone={CERT_TONE[c.verificationStatus]} dot>
                                                                {t(`certStatus.${c.verificationStatus.toLowerCase()}`)}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-3.5 text-gray-400">{fmtDate(c.issuingDate)}</td>
                                                        <td className="p-3.5">
                                                            {c.printedAt ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <Badge tone="green" dot>
                                                                        {t('report.cert_printed_yes')}
                                                                    </Badge>
                                                                    <span className="text-xs text-gray-400">{fmtDate(c.printedAt)}</span>
                                                                    {c.printedBy?.email && (
                                                                        <span className="text-xs text-gray-500" dir="ltr">{c.printedBy.email}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => markPrinted(c.id)}
                                                                    disabled={markingId === c.id || c.verificationStatus === 'REVOKED'}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold-light text-xs font-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                >
                                                                    <Printer size={13} />
                                                                    {markingId === c.id ? t('common.loading') : t('report.cert_mark_printed')}
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="p-3.5 text-gray-500 font-mono text-xs" dir="ltr">
                                                            {c.verificationCode.slice(0, 8)}…
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <p className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-400 flex items-start gap-2">
                                    <Info size={16} className="shrink-0 mt-0.5" />
                                    <span>{t('report.cert_course_level_note')}</span>
                                </p>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
