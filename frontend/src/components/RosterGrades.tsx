"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { Loader, Plus, Pencil, Trash2, X, Check, GraduationCap, UserPlus, Search, Download } from 'lucide-react';
import { Badge, EmptyPanel, BtnPrimary } from '@/app/dashboard/admin/components';

interface Assessment { id: string; nameAr: string; nameEn: string; maxScore: number; orderIndex: number; }
interface EnrollmentRow {
    id: string;
    status: string;
    createdAt: string;
    student: { id: string; email: string; name?: string | null };
    grades: { assessmentId: string; score: number; notes?: string | null }[];
}
interface Roster {
    opening: { id: string; nameAr?: string | null; nameEn?: string | null; isPublished: boolean };
    course: { id: string; titleAr?: string | null; titleEn?: string | null };
    assessments: Assessment[];
    enrollments: EnrollmentRow[];
}

const statusTone: Record<string, 'green' | 'amber' | 'red' | 'blue'> = {
    APPROVED: 'green',
    PENDING: 'amber',
    REJECTED: 'red',
    RESERVED: 'blue',
};

const statusKey: Record<string, string> = {
    APPROVED: 'statuses.approved',
    PENDING: 'statuses.pending',
    REJECTED: 'statuses.rejected',
    RESERVED: 'statuses.reserved',
};

const avatarTones = [
    'bg-brand-gold/20 text-gold-ink',
    'bg-emerald-500/20 text-emerald-800 dark:text-emerald-400',
    'bg-sky-500/20 text-sky-800 dark:text-sky-400',
    'bg-violet-500/20 text-violet-800 dark:text-violet-400',
    'bg-rose-500/20 text-rose-400',
    'bg-cyan-500/20 text-cyan-400',
];

const avatarToneFor = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return avatarTones[h % avatarTones.length];
};

export default function RosterGrades({ openingId }: { openingId: string }) {
    const { t, pick } = useI18n();
    const { user } = useAuth();
    const [roster, setRoster] = useState<Roster | null>(null);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [search, setSearch] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Assessment | null>(null);
    const [aNameAr, setANameAr] = useState('');
    const [aNameEn, setANameEn] = useState('');
    const [aMax, setAMax] = useState('100');
    const [savingAssess, setSavingAssess] = useState(false);

    const canAddStudent = user && (user.role === 'ADMIN' || user.role === 'COURSE_MANAGER');

    const [enrollOpen, setEnrollOpen] = useState(false);
    const [students, setStudents] = useState<{ id: string; email: string }[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [openings, setOpenings] = useState<{ id: string; nameAr?: string | null; nameEn?: string | null; isPublished: boolean }[]>([]);
    const [selectedOpeningId, setSelectedOpeningId] = useState(openingId);
    const [savingEnroll, setSavingEnroll] = useState(false);
    const [loadingEnroll, setLoadingEnroll] = useState(false);

    const openEnroll = async () => {
        setEnrollOpen(true);
        setSelectedStudentId('');
        setSelectedOpeningId(openingId);
        if (students.length) return;
        setLoadingEnroll(true);
        try {
            const [uRes, cRes] = await Promise.all([
                api.get('/users'),
                api.get('/courses?includeUnpublished=true'),
            ]);
            const studentList = ((uRes.data || []) as { id: string; email: string; role?: string }[])
                .filter(u => u.role === 'STUDENT')
                .map(({ id, email }) => ({ id, email }));
            setStudents(studentList);
            const courseId = roster?.course.id;
            const openingsList = (cRes.data || []).flatMap((c: { id: string; openings?: typeof openings }) =>
                c.id === courseId ? (c.openings || []) : []
            );
            setOpenings(openingsList);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('roster.add_student_fail'));
        } finally {
            setLoadingEnroll(false);
        }
    };

    const handleEnrollStudent = async () => {
        if (!roster) return;
        if (!selectedStudentId) {
            toast.error(t('roster.select_student_required'));
            return;
        }
        setSavingEnroll(true);
        try {
            await api.post('/enrollments/admin', {
                courseId: roster.course.id,
                studentId: selectedStudentId,
                ...(selectedOpeningId ? { openingId: selectedOpeningId } : {}),
            });
            toast.success(t('roster.student_added'));
            setEnrollOpen(false);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('roster.add_student_fail'));
        }
        setSavingEnroll(false);
    };

    useEffect(() => {
        let active = true;
        const run = async () => {
            if (!openingId) return;
            try {
                const res = await api.get(`/openings/${openingId}/roster`);
                if (!active) return;
                setRoster(res.data);
                const g: Record<string, string> = {};
                (res.data as Roster).enrollments.forEach((e) =>
                    e.grades.forEach((gr) => { g[`${e.id}|${gr.assessmentId}`] = String(gr.score); })
                );
                setDrafts(g);
            } catch (err) {
                if (active) toast.error(getErrorMessage(err) || t('roster.assessment_fail'));
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => { active = false; };
    }, [openingId, refreshKey, t]);

    const cellValue = (enrId: string, asmId: string): string => {
        const key = `${enrId}|${asmId}`;
        if (drafts[key] !== undefined) return drafts[key];
        const grade = roster?.enrollments.find((e) => e.id === enrId)?.grades.find((g) => g.assessmentId === asmId);
        return grade ? String(grade.score) : '';
    };

    const setCell = (enrId: string, asmId: string, value: string) => {
        setDrafts((prev) => ({ ...prev, [`${enrId}|${asmId}`]: value }));
    };

    const totalOf = (enr: EnrollmentRow) =>
        (roster?.assessments || []).reduce((sum, a) => {
            const v = Number(cellValue(enr.id, a.id));
            return sum + (isNaN(v) ? 0 : v);
        }, 0);

    const handleSaveGrade = async (enrId: string, asmId: string) => {
        const raw = cellValue(enrId, asmId);
        if (raw === '') return;
        const score = Number(raw);
        if (isNaN(score)) { toast.error(t('roster.grade_invalid')); return; }
        try {
            await api.put('/grades', { enrollmentId: enrId, assessmentId: asmId, score });
            toast.success(t('roster.score_saved'));
            setDrafts((prev) => ({ ...prev, [`${enrId}|${asmId}`]: String(score) }));
            setRefreshKey((k) => k + 1);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('roster.score_fail'));
        }
    };

    const handleClearGrade = async (enrId: string, asmId: string) => {
        if (!window.confirm(t('roster.clear_grade_confirm'))) return;
        try {
            await api.delete(`/grades/${enrId}/${asmId}`);
            toast.success(t('roster.grade_cleared'));
            setDrafts((prev) => { const next = { ...prev }; delete next[`${enrId}|${asmId}`]; return next; });
            setRefreshKey((k) => k + 1);
        } catch {
            toast.error(t('roster.score_fail'));
        }
    };

    const openAdd = () => { setEditing(null); setANameAr(''); setANameEn(''); setAMax('100'); setModalOpen(true); };
    const openEdit = (a: Assessment) => { setEditing(a); setANameAr(a.nameAr); setANameEn(a.nameEn); setAMax(String(a.maxScore)); setModalOpen(true); };

    const handleSaveAssessment = async () => {
        if (!aNameAr.trim() || !aNameEn.trim()) { toast.error(t('roster.assessment_fail')); return; }
        setSavingAssess(true);
        try {
            const body = { nameAr: aNameAr.trim(), nameEn: aNameEn.trim(), maxScore: Number(aMax) || 100 };
            if (editing) {
                await api.patch(`/assessments/${editing.id}`, body);
                toast.success(t('roster.assessment_updated'));
            } else {
                await api.post(`/openings/${openingId}/assessments`, body);
                toast.success(t('roster.assessment_added'));
            }
            setModalOpen(false);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('roster.assessment_fail'));
        }
        setSavingAssess(false);
    };

    const handleDeleteAssessment = async (a: Assessment) => {
        if (!window.confirm(t('roster.delete_assessment_confirm'))) return;
        try {
            await api.delete(`/assessments/${a.id}`);
            toast.success(t('roster.assessment_deleted'));
            setRefreshKey((k) => k + 1);
        } catch {
            toast.error(t('roster.assessment_fail'));
        }
    };

    if (loading && !roster) {
        return <div className="h-64 flex items-center justify-center text-accent"><Loader className="animate-spin" size={36} /></div>;
    }

    const assessments = roster?.assessments || [];
    const enrollments = roster?.enrollments || [];
    const filtered = enrollments.filter(e =>
        !search || e.student.email.toLowerCase().includes(search.toLowerCase())
    );
    const maxTotal = assessments.reduce((sum, a) => sum + (a.maxScore || 0), 0);
    const pctOf = (enr: EnrollmentRow) =>
        maxTotal > 0 ? `${((totalOf(enr) / maxTotal) * 100).toFixed(0)}%` : '—';

    const exportCSV = () => {
        const headers = ['Student', 'Status', ...assessments.map(a => pick(a, 'name')), 'Total'];
        const rows = filtered.map(e => [
            e.student.email,
            e.status,
            ...assessments.map(a => cellValue(e.id, a.id) || ''),
            String(totalOf(e)),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'grades.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const inputCls = "w-20 px-2 py-1.5 text-center bg-ink/[0.04] border border-line rounded-lg focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/40 text-ink outline-none text-sm";

    return (
        <div className="bg-surface-sunken p-6 lg:p-8 rounded-3xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-ink tracking-tight">{t('roster.tab_label')}</h2>
                    <p className="text-ink-subtle text-sm mt-0.5">{t('roster.subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <BtnPrimary icon={Plus} onClick={openAdd}>{t('roster.add_assessment')}</BtnPrimary>
                    {canAddStudent && <BtnPrimary icon={UserPlus} onClick={openEnroll}>{t('roster.add_student')}</BtnPrimary>}
                </div>
            </div>

            {/* Assessments header */}
            <div className="mb-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-sm font-black text-ink-subtle">{t('roster.assessments_title')}:</span>
                    {assessments.length === 0 && <span className="text-sm text-ink-subtle">{t('roster.no_assessments')}</span>}
                    {assessments.map((a) => (
                        <span key={a.id} className="inline-flex max-w-[70%] items-center gap-1.5 bg-ink/[0.04] border border-line rounded-xl px-3 py-1.5">
                            <span className="text-sm font-bold text-ink truncate">{pick(a, 'name')} <span className="text-ink-subtle font-normal">({a.maxScore})</span></span>
                            <button onClick={() => openEdit(a)} className="text-ink-subtle hover:text-accent transition" title={t('common.edit')}><Pencil size={13} /></button>
                            <button onClick={() => handleDeleteAssessment(a)} className="text-ink-subtle hover:text-red-500 transition" title={t('common.delete')}><Trash2 size={13} /></button>
                        </span>
                    ))}
                </div>
            </div>

            {/* Search + Export */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`${t('roster.col_student')}...`}
                        className="w-full pl-10 pr-4 py-2.5 bg-ink/[0.04] border border-line text-ink text-placeholder:ink-subtle rounded-xl focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/40 outline-none transition text-sm"
                    />
                </div>
                <button
                    onClick={exportCSV}
                    disabled={filtered.length === 0}
                    className="inline-flex items-center gap-2 bg-ink/[0.04] hover:bg-ink/[0.08] border border-line text-ink text-sm font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={16} /> Export CSV
                </button>
            </div>

            {enrollments.length === 0 ? (
                <EmptyPanel icon={GraduationCap} title={t('roster.no_students')} />
            ) : (
                <div className="admin-table-wrap overflow-x-auto">
                    <table className="admin-table text-left min-w-full">
                        <thead>
                            <tr>
                                <th>{t('roster.col_student')}</th>
                                <th>{t('roster.col_details')}</th>
                                <th>{t('roster.col_status')}</th>
                                {assessments.map((a) => (
                                    <th key={a.id} className="text-center">{pick(a, 'name')}</th>
                                ))}
                                <th className="text-center">{t('roster.total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={3 + assessments.length + 1} className="p-8 text-center text-sm text-ink-subtle">
                                        {t('roster.no_students')}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((e) => (
                                    <tr key={e.id} className="animate-fade-in">
                                        <td className="p-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-9 h-9 shrink-0 rounded-full ${avatarToneFor(e.student.email)} inline-flex items-center justify-center font-black text-sm uppercase`}>
                                                    {(e.student.name?.trim()?.[0] || e.student.email[0] || '?').toUpperCase()}
                                                </span>
                                                <div className="min-w-0">
                                                    {e.student.name && (
                                                        <p className="font-bold text-ink leading-tight">{e.student.name}</p>
                                                    )}
                                                    <p className={`text-sm text-ink-muted truncate ${e.student.name ? '' : 'font-bold text-ink'}`}>{e.student.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-ink-subtle whitespace-nowrap">
                                            {t('roster.registered_on')}: {new Date(e.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <Badge tone={statusTone[e.status] ?? 'gray'}>{t(statusKey[e.status] ?? '')}</Badge>
                                        </td>
                                        {assessments.map((a) => (
                                            <td key={a.id} className="p-2 text-center">
                                                <div className="inline-flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min={0}
                                                        value={cellValue(e.id, a.id)}
                                                        onChange={(ev) => setCell(e.id, a.id, ev.target.value)}
                                                        onBlur={() => handleSaveGrade(e.id, a.id)}
                                                        onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.currentTarget.blur(); } }}
                                                        className={inputCls}
                                                        placeholder="—"
                                                    />
                                                    {cellValue(e.id, a.id) !== '' && (
                                                        <button onClick={() => handleClearGrade(e.id, a.id)} className="text-ink-subtle text-red-700 dark:text-red-400 transition" title={t('common.delete')}>
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-4 text-center font-black text-accent whitespace-nowrap">
                                            {totalOf(e)} <span className="text-ink-subtle font-normal">({pctOf(e)})</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-xs text-ink-subtle mt-5">
                <Link href="/dashboard/admin/users" className="text-accent font-bold hover:text-accent underline underline-offset-2">
                    {t('roster.add_student_hint')}
                </Link>
            </p>

            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
                    <div className="bg-surface rounded-3xl shadow-2xl p-6 lg:p-8 w-full max-w-md animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-ink">{editing ? t('roster.edit_assessment') : t('roster.add_assessment')}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-ink-subtle hover:text-ink"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-ink-muted mb-1">{t('roster.assessment_name_ar')} *</label>
                                <input value={aNameAr} onChange={(e) => setANameAr(e.target.value)} className="w-full px-4 py-3 bg-ink/[0.04] border border-line text-ink rounded-xl focus:ring-2 focus:ring-brand-gold/40 outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ink-muted mb-1">{t('roster.assessment_name_en')} *</label>
                                <input value={aNameEn} onChange={(e) => setANameEn(e.target.value)} className="w-full px-4 py-3 bg-ink/[0.04] border border-line text-ink rounded-xl focus:ring-2 focus:ring-brand-gold/40 outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ink-muted mb-1">{t('roster.assessment_max_score')}</label>
                                <input type="number" min={1} value={aMax} onChange={(e) => setAMax(e.target.value)} className="w-full px-4 py-3 bg-ink/[0.04] border border-line text-ink rounded-xl focus:ring-2 focus:ring-brand-gold/40 outline-none transition" />
                            </div>
                            <button
                                onClick={handleSaveAssessment}
                                disabled={savingAssess}
                                className="w-full inline-flex items-center justify-center gap-2 bg-brand-gold hover:bg-brand-gold-light text-ink-on-gold font-bold py-3.5 rounded-xl transition disabled:opacity-50"
                            >
                                <Check size={18} /> {savingAssess ? t('common.saving') : t('roster.add_assessment_save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {enrollOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEnrollOpen(false)}>
                    <div className="bg-surface rounded-3xl shadow-2xl p-6 lg:p-8 w-full max-w-md animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-ink">{t('roster.add_student_title')}</h3>
                            <button onClick={() => setEnrollOpen(false)} className="text-ink-subtle hover:text-ink"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-ink-muted mb-1">{t('roster.select_student')} *</label>
                                <select
                                    value={selectedStudentId}
                                    onChange={(e) => setSelectedStudentId(e.target.value)}
                                    disabled={loadingEnroll}
                                    className="w-full px-4 py-3 bg-ink/[0.04] border border-line text-ink rounded-xl focus:ring-2 focus:ring-brand-gold/40 outline-none transition disabled:opacity-50"
                                >
                                    <option value="">{loadingEnroll ? t('common.loading') : t('roster.select_student_placeholder')}</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>{s.email}</option>
                                    ))}
                                </select>
                                {!loadingEnroll && students.length === 0 && (
                                    <p className="text-xs text-ink-subtle mt-1">{t('roster.no_students_available')}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ink-muted mb-1">{t('roster.select_opening')}</label>
                                <select
                                    value={selectedOpeningId}
                                    onChange={(e) => setSelectedOpeningId(e.target.value)}
                                    disabled={loadingEnroll}
                                    className="w-full px-4 py-3 bg-ink/[0.04] border border-line text-ink rounded-xl focus:ring-2 focus:ring-brand-gold/40 outline-none transition disabled:opacity-50"
                                >
                                    {openings.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {pick(o, 'name') || `#${o.id.slice(0, 4)}`}{o.isPublished ? '' : ` (${t('admin.draft_tag')})`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleEnrollStudent}
                                disabled={savingEnroll}
                                className="w-full inline-flex items-center justify-center gap-2 bg-brand-gold hover:bg-brand-gold-light text-ink-on-gold font-bold py-3.5 rounded-xl transition disabled:opacity-50"
                            >
                                <Check size={18} /> {savingEnroll ? t('common.saving') : t('roster.add_student_save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
