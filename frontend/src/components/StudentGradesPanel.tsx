"use client";

import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { GraduationCap, Loader } from 'lucide-react';

interface GradeRow {
    id: string;
    score: number;
    notes?: string | null;
    assessment: { id: string; nameAr: string; nameEn: string; maxScore: number };
}

interface GradedEnrollment {
    course: { id: string; titleAr?: string | null; titleEn?: string | null };
    opening?: { id: string; nameAr?: string | null; nameEn?: string | null } | null;
    grades: GradeRow[];
}

interface Props {
    courseId: string;
}

export default function StudentGradesPanel({ courseId }: Props) {
    const { data: enrollments, loading } = useFetchData<GradedEnrollment[]>('/enrollments/my/grades');
    const { t, pick } = useI18n();

    const pct = (row: GradeRow) => (row.assessment.maxScore > 0 ? Math.round((row.score / row.assessment.maxScore) * 100) : 0);
    const courseAvg = (rows: GradeRow[]) => (rows.length ? Math.round(rows.reduce((s, r) => s + pct(r), 0) / rows.length) : null);

    const enrollment = (enrollments || []).find(e => e.course.id === courseId);
    const grades = enrollment?.grades || [];
    const avg = courseAvg(grades);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <GraduationCap size={24} className="text-accent" />
                <h2 className="text-2xl font-black text-ink">{t('myGrades.heading')}</h2>
            </div>

            {loading ? (
                <div className="h-48 flex items-center justify-center text-ink">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : !enrollment || grades.length === 0 ? (
                <div className="text-center text-ink-subtle font-bold py-16">{t('myGrades.no_grades')}</div>
            ) : (
                <div className="border border-brand-mist rounded-3xl overflow-x-auto">
                    <div className="bg-gradient-to-r from-brand-navy to-brand-charcoal text-ink p-5 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h3 className="text-xl font-black">{pick(enrollment.course, 'title')}</h3>
                            {pick(enrollment.opening, 'name') && (
                                <p className="text-sm text-ink-muted mt-0.5">{pick(enrollment.opening, 'name')}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-accent">{avg}%</div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-muted font-bold">{t('myGrades.average')}</div>
                        </div>
                    </div>
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('myGrades.col_assessment')}</th>
                                <th>{t('myGrades.col_score')}</th>
                                <th>{t('myGrades.col_percentage')}</th>
                                <th>{t('myGrades.col_notes')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-mist/50">
                            {grades.map(g => (
                                <tr key={g.id}>
                                    <td className="p-4 font-bold text-ink-muted">{pick(g.assessment, 'name')}</td>
                                    <td className="p-4">{g.score} / {g.assessment.maxScore}</td>
                                    <td className="p-4">{pct(g)}%</td>
                                    <td className="p-4 text-ink-subtle text-sm">{g.notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}