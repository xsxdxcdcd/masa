"use client";

import { useState, useEffect, useCallback } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { X, Award, CheckCircle2, Loader, ShieldOff } from 'lucide-react';

interface Candidate {
    studentId: string;
    email: string;
    certificateStatus: string | null;
    certificateId: string | null;
}

interface Props {
    openingId: string;
    openingTitle: string;
    canRevoke: boolean;
    onClose: () => void;
    onIssued?: () => void;
}

const statusMeta: Record<string, { label: string; cls: string }> = {
    VALID: { label: '✅ سارية / Valid', cls: 'bg-green-500/10 text-green-900 dark:text-green-400 border border-green-500/20' },
    REVOKED: { label: '🚫 ملغاة / Revoked', cls: 'bg-red-500/10 text-red-800 dark:text-red-400 border border-red-500/20' },
    EXPIRED: { label: '⏰ منتهية / Expired', cls: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20' },
    EXTERNAL: { label: '🌐 خارجية / External', cls: 'bg-surface-raised text-ink border border-brand-navy-light/20' },
};

export default function CertificateApprovalModal({ openingId, openingTitle, canRevoke, onClose, onIssued }: Props) {
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';
    const [candidates, setCandidates] = useState<Candidate[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [issuing, setIssuing] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<Candidate[]>(`/certificates/openings/${openingId}/candidates`);
            setCandidates(res.data);
            // Pre-select students who don't have a valid certificate yet.
            setSelected(new Set(res.data.filter(c => !c.certificateStatus || c.certificateStatus !== 'VALID').map(c => c.studentId)));
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    }, [openingId]);

    useEffect(() => { load(); }, [load]);

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const issue = async () => {
        if (selected.size === 0) return;
        setIssuing(true);
        try {
            await api.post(`/certificates/openings/${openingId}/issue`, { studentIds: [...selected] });
            toast.success(isAr ? 'تم إصدار الشهادات بنجاح' : 'Certificates issued successfully');
            await load();
            onIssued?.();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setIssuing(false);
        }
    };

    const revoke = async (candidate: Candidate) => {
        if (!candidate.certificateId) return;
        setRevokingId(candidate.certificateId);
        try {
            await api.post(`/certificates/${candidate.certificateId}/revoke`);
            toast.success(isAr ? 'تم إلغاء الشهادة' : 'Certificate revoked');
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setRevokingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-surface border border-line rounded-3xl shadow-2xl p-6 lg:p-8 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black text-ink flex items-center gap-2">
                            <Award size={20} className="text-accent" />
                            {isAr ? 'إصدار الشهادات' : 'Issue Certificates'}
                        </h3>
                        <p className="text-sm text-ink-subtle mt-1">{openingTitle}</p>
                        <p className="text-xs text-ink-subtle mt-2">
                            {isAr ? 'اختر الطلاب المستحقين للشهادة ثم اضغط إصدار. لا تُصدر الشهادات تلقائياً بعد انتهاء الدورة.' : 'Select the students to receive a certificate, then click issue. Certificates are not issued automatically when the opening ends.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-subtle hover:text-ink"><X size={20} /></button>
                </div>

                {loading ? (
                    <div className="h-40 flex items-center justify-center text-ink-subtle"><Loader className="animate-spin me-2" size={20} /> {isAr ? 'جاري التحميل...' : 'Loading...'}</div>
                ) : (candidates || []).length === 0 ? (
                    <div className="text-center py-12 text-ink-subtle border-2 border-dashed border-line rounded-xl">
                        <Award size={40} className="mx-auto mb-3 text-ink-subtle" />
                        <p className="font-bold">{isAr ? 'لا يوجد طلاب معتمدون مؤهلون' : 'No approved students eligible'}</p>
                        <p className="text-xs mt-1">{isAr ? 'تُمنح الشهادات للطلاب ذوي التسجيل المعتمد (APPROVED) فقط.' : 'Certificates are granted only to students with an APPROVED enrollment.'}</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 mb-6">
                            {(candidates || []).map(c => {
                                const isChecked = selected.has(c.studentId);
                                const hasValid = c.certificateStatus === 'VALID';
                                const meta = statusMeta[c.certificateStatus || ''];
                                return (
                                    <div key={c.studentId} className={`flex items-center gap-3 bg-surface-sunken border border-line rounded-xl px-4 py-3 transition ${isChecked ? 'border-brand-gold/40' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={issuing}
                                            onChange={() => toggle(c.studentId)}
                                            className="w-5 h-5 accent-brand-gold cursor-pointer shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-ink truncate">{c.email}</p>
                                            <p className="text-xs text-ink-muted">{c.studentId}</p>
                                        </div>
                                        {c.certificateStatus ? (
                                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full shrink-0 ${meta?.cls ?? statusMeta.EXTERNAL.cls}`}>
                                                {meta?.label ?? c.certificateStatus}
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full shrink-0 bg-ink/[0.01] text-ink-muted border border-line">
                                                {isAr ? 'بدون شهادة' : 'No certificate'}
                                            </span>
                                        )}
                                        {hasValid && canRevoke && (
                                            <button
                                                onClick={() => revoke(c)}
                                                disabled={revokingId === c.certificateId}
                                                title={isAr ? 'إلغاء الشهادة' : 'Revoke certificate'}
                                                className={`admin-action-btn shrink-0 tooltip disabled:opacity-40 text-red-800 dark:text-red-400 hover:bg-red-500/10 ${c.certificateStatus === 'VALID' ? '' : 'opacity-40 pointer-events-none'}`}
                                            >
                                                {revokingId === c.certificateId ? <Loader className="animate-spin" size={16} /> : <ShieldOff size={16} />}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={issue}
                                disabled={issuing || selected.size === 0}
                                className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black font-bold py-3 rounded-xl hover:opacity-95 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                {issuing ? <Loader className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                {isAr ? `إصدار (${selected.size})` : `Issue (${selected.size})`}
                            </button>
                            <button onClick={onClose} className="px-6 bg-ink/[0.04] text-ink-muted hover:bg-ink/[0.08] font-bold py-3 rounded-xl transition">Cancel</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}