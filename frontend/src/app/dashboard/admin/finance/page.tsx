"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage, fetchProtectedFile, downloadProtectedFile } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Check, X, FileImage, ExternalLink, RefreshCw, ShieldCheck, Wallet, CreditCard, Save, Tag, RotateCcw } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnSoft, BtnPrimary, type Tone } from '../components';
import { formatPrice } from '@/lib/format';

interface EnrollmentPayment {
    id: string;
    status: string;
    amount: number | string;
    couponCode?: string | null;
    coupon?: {
        id: string;
        name: string;
        sourceName?: string | null;
        channel?: string | null;
        type: 'PERCENT' | 'AMOUNT';
        value: number | string;
    } | null;
}

interface Enrollment {
    id: string;
    createdAt: string;
    status: string;
    receiptFileUrl?: string | null;
    financeOfficerNotes?: string | null;
    student?: { email: string } | null;
    course?: { titleAr?: string | null; titleEn?: string | null } | null;
    opening?: { price: string; nameAr?: string | null; nameEn?: string | null; isPublished: boolean } | null;
    payments?: EnrollmentPayment[] | null;
}

interface Payment {
    id: string;
    amount: number | string;
    status: string;
    method?: string | null;
    createdAt: string;
    user?: { email: string } | null;
    enrollment?: { course?: { titleAr?: string | null; titleEn?: string | null } | null } | null;
}

interface RefundRequest {
    id: string;
    status: string;
    amount: number | string;
    currency: string;
    method: string;
    accountName: string;
    accountNumber: string;
    studentNote?: string | null;
    reviewerNote?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    student?: { email: string } | null;
    course?: { titleAr?: string | null; titleEn?: string | null } | null;
    opening?: { nameAr?: string | null; nameEn?: string | null } | null;
    payment?: { id: string; receiptFileUrl?: string | null; enrollmentId?: string | null } | null;
}

const statusTone: Record<string, Tone> = {
    PENDING: 'amber',
    APPROVED: 'green',
    REJECTED: 'red',
    RESERVED: 'blue',
    PAID: 'green',
    FAILED: 'red',
    REFUNDED: 'purple',
    CANCELLED: 'gray',
    REVOKED: 'navy',
};

type Filter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESERVED';

export default function AdminFinancePage() {
    const { data: enrollments, loading, error, refetch } = useFetchData<Enrollment[]>('/enrollments/all');
    const [activeTab, setActiveTab] = useState<'enrollments' | 'payments' | 'refunds'>('enrollments');
    const { data: payments, loading: paymentsLoading, error: paymentsError } = useFetchData<Payment[]>(activeTab === 'payments' ? '/payments' : null);
    const { data: refunds, loading: refundsLoading, error: refundsError, refetch: refetchRefunds } = useFetchData<RefundRequest[]>(activeTab === 'refunds' ? '/refunds' : null);
    const { t, pick, locale } = useI18n();
    const [statusFilter, setStatusFilter] = useState<Filter>('ALL');
    const [selected, setSelected] = useState<Enrollment | null>(null);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [receiptError, setReceiptError] = useState<string | null>(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
    const [refundRejecting, setRefundRejecting] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [refundProcessing, setRefundProcessing] = useState(false);
    const [refundReceiptUrl, setRefundReceiptUrl] = useState<string | null>(null);
    const [refundReceiptLoading, setRefundReceiptLoading] = useState(false);
    const [refundReceiptError, setRefundReceiptError] = useState<string | null>(null);

    const counts = {
        ALL: (enrollments || []).length,
        PENDING: (enrollments || []).filter(e => e.status === 'PENDING').length,
        APPROVED: (enrollments || []).filter(e => e.status === 'APPROVED').length,
        REJECTED: (enrollments || []).filter(e => e.status === 'REJECTED').length,
        RESERVED: (enrollments || []).filter(e => e.status === 'RESERVED').length,
    };

    const filtered = (enrollments || []).filter(e => statusFilter === 'ALL' || e.status === statusFilter);

    const handleVerify = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED' && !reason.trim()) {
            toast.error(t('finance.provided_reason'));
            return;
        }
        setProcessing(true);
        try {
            await api.patch(`/enrollments/${id}/review`, { status, notes: status === 'REJECTED' ? reason : undefined });
            toast.success(status === 'APPROVED' ? t('finance.approved_msg') : t('finance.rejected_msg'));
            setSelected(null);
            setIsRejecting(false);
            setReason('');
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || (status === 'APPROVED' ? t('finance.approve_fail') : t('finance.reject_fail')));
        }
        setProcessing(false);
    };

    const openReceipt = async (e: Enrollment, reject = false) => {
        setSelected(e);
        setIsRejecting(reject);
        setReason('');
        setReceiptUrl(null);
        setReceiptError(null);
        if (e.receiptFileUrl) {
            setReceiptLoading(true);
            try {
                const { url } = await fetchProtectedFile(`/enrollments/${e.id}/receipt`);
                setReceiptUrl(url);
            } catch (err) {
                setReceiptError(getErrorMessage(err) || t('finance.receipt_load_failed'));
            } finally {
                setReceiptLoading(false);
            }
        }
    };

    const closeModal = () => {
        setSelected(null);
        setIsRejecting(false);
        setReason('');
        if (receiptUrl) URL.revokeObjectURL(receiptUrl);
        setReceiptUrl(null);
        setReceiptError(null);
    };

    const openRefund = async (r: RefundRequest, reject = false) => {
        setSelectedRefund(r);
        setRefundRejecting(reject);
        setRefundReason('');
        setRefundReceiptUrl(null);
        setRefundReceiptError(null);
        const enrollmentId = r.payment?.enrollmentId;
        if (enrollmentId && r.payment?.receiptFileUrl) {
            setRefundReceiptLoading(true);
            try {
                const { url } = await fetchProtectedFile(`/enrollments/${enrollmentId}/receipt`);
                setRefundReceiptUrl(url);
            } catch (err) {
                setRefundReceiptError(getErrorMessage(err) || t('finance.receipt_load_failed'));
            } finally {
                setRefundReceiptLoading(false);
            }
        }
    };

    const closeRefund = () => {
        if (refundReceiptUrl && refundReceiptUrl.startsWith('blob:')) URL.revokeObjectURL(refundReceiptUrl);
        setSelectedRefund(null);
        setRefundRejecting(false);
        setRefundReason('');
        setRefundReceiptUrl(null);
        setRefundReceiptError(null);
    };

    const reviewRefund = async (status: 'APPROVED' | 'REJECTED') => {
        if (!selectedRefund) return;
        if (status === 'REJECTED' && !refundReason.trim()) {
            toast.error(t('finance.provided_reason'));
            return;
        }
        setRefundProcessing(true);
        try {
            await api.patch(`/refunds/${selectedRefund.id}`, {
                status,
                reviewerNote: status === 'REJECTED' ? refundReason.trim() : undefined,
            });
            toast.success(status === 'APPROVED' ? t('refunds.approved_msg') : t('refunds.rejected_msg'));
            closeRefund();
            refetchRefunds();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('refunds.review_failed'));
        } finally {
            setRefundProcessing(false);
        }
    };

    const statBtn = (s: Filter) => (        <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl p-3 text-start transition-all duration-200 ${statusFilter === s
                ? 'bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white shadow-lg shadow-black/25 scale-[1.02] border border-white/10'
                : 'bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 hover:shadow-md'
                }`}
        >
            <div className="admin-stat-value">{counts[s]}</div>
            <div className={`text-[11px] font-black mt-1 ${statusFilter === s ? 'text-brand-gold-light' : 'text-gray-500 dark:text-gray-400'}`}>
                {s === 'ALL' ? t('admin.filter_all') : t('statuses.' + s.toLowerCase())}
            </div>
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.finance_heading')}
                subtitle={t('admin.finance_subtitle')}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <BtnPrimary icon={Tag} href="/dashboard/admin/finance/coupons">{t('finance.coupons.title')}</BtnPrimary>
                        <BtnSoft icon={RefreshCw} onClick={refetch}>{t('admin.refresh')}</BtnSoft>
                    </div>
                }
            />

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl w-full max-w-full overflow-x-auto animate-fade-in-up">
                <button
                    onClick={() => setActiveTab('enrollments')}
                    className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${activeTab === 'enrollments'
                        ? 'bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white shadow-lg shadow-black/25 border border-white/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                >
                    <ShieldCheck size={16} /> {t('finance.tab_enrollments')}
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${activeTab === 'payments'
                        ? 'bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white shadow-lg shadow-black/25 border border-white/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                >
                    <Wallet size={16} /> {t('finance.tab_payments')}
                </button>
                <button
                    onClick={() => setActiveTab('refunds')}
                    className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${activeTab === 'refunds'
                        ? 'bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white shadow-lg shadow-black/25 border border-white/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                >
                    <RotateCcw size={16} /> {t('finance.tab_refunds')}
                </button>
            </div>

            {activeTab === 'enrollments' && (<>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in-up">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RESERVED'] as const).map(s => statBtn(s))}
            </div>

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('finance.loading')}</div>
            ) : (
                <div className="admin-table-wrap animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('finance.col_student')}</th>
                                <th>{t('finance.col_course')}</th>
                                <th>{t('admin.col_status')}</th>
                                <th className="text-center">{t('finance.col_receipt')}</th>
                                <th className="text-right">{t('finance.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {filtered.map(e => {
                                const payment = e.payments?.[0];
                                const coupon = payment?.coupon;
                                return (
                                <tr key={e.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                    <td className="p-4">
                                        <div className="font-bold text-brand-navy dark:text-gray-200">{e.student?.email || t('finance.unknown_student')}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(e.createdAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-brand-navy dark:text-white">{pick(e.course, 'title')}</div>
                                        <div className="text-sm font-black text-brand-gold-dark dark:text-brand-gold-light">${e.opening?.price ?? '—'}</div>
                                        {pick(e.opening, 'name') && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{pick(e.opening, 'name')}</div>}
                                        {coupon && (
                                            <div className="mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-bold text-brand-gold-dark dark:text-brand-gold-light bg-brand-gold/10 border border-brand-gold/20 rounded-lg px-2 py-1">
                                                <Tag size={12} />
                                                <span>{payment?.couponCode || coupon.name}</span>
                                                <span>· {coupon.type === 'PERCENT' ? `${Number(coupon.value)}%` : formatPrice(Number(coupon.value), { locale })} {t('finance.coupon_off')}</span>
                                                {coupon.sourceName && <span>· {t('finance.coupon_owner')}: {coupon.sourceName}</span>}
                                                {coupon.channel && <span>· {t('finance.coupon_channel')}: {coupon.channel}</span>}
                                                {payment?.amount != null && <span>· {formatPrice(Number(payment.amount), { locale })}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <Badge tone={statusTone[e.status] || 'gray'} dot>{t('statuses.' + (e.status || '').toLowerCase())}</Badge>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => openReceipt(e)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-brand-navy dark:hover:text-white rounded-xl text-sm font-bold transition-all duration-200">
                                            <FileImage size={16} /> {t('finance.view_receipt')}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        {e.status === 'PENDING' ? (
                                            <>
                                                <button onClick={() => handleVerify(e.id, 'APPROVED')} disabled={processing} className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20 px-3.5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40">
                                                    <Check size={16} /> {t('finance.approve')}
                                                </button>
                                                <button onClick={() => openReceipt(e, true)} disabled={processing} className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20 px-3.5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40 ms-2">
                                                    <X size={16} /> {t('finance.reject')}
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.no_action')}</span>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <EmptyState icon={ShieldCheck} title={t('finance.all_caught_up')} color="green" />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Receipt modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-brand-navy border border-white/10 rounded-3xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center gap-4 bg-gradient-to-r from-brand-navy to-brand-navy-dark">
                            <div className="min-w-0">
                                <h3 className="text-xl font-black text-white">{isRejecting ? t('finance.reject_title') : t('finance.verification_title')}</h3>
                                <p className="text-sm text-gray-400 mt-1 min-w-0">
                                    {t('finance.student_label')} <span className="font-bold text-white break-all">{selected.student?.email}</span> | {t('finance.course_label')} <span className="font-bold text-white break-all">{pick(selected.course, 'title')}</span>
                                </p>
                                {selected.payments?.[0]?.coupon && (
                                    <p className="text-xs font-bold text-brand-gold-light mt-1.5 inline-flex flex-wrap items-center gap-x-1.5">
                                        <Tag size={12} />
                                        <span>{selected.payments[0].couponCode || selected.payments[0].coupon.name}</span>
                                        <span>· {selected.payments[0].coupon.type === 'PERCENT' ? `${Number(selected.payments[0].coupon.value)}%` : formatPrice(Number(selected.payments[0].coupon.value), { locale })} {t('finance.coupon_off')}</span>
                                        {selected.payments[0].coupon.sourceName && <span>· {t('finance.coupon_owner')}: {selected.payments[0].coupon.sourceName}</span>}
                                        {selected.payments[0].coupon.channel && <span>· {t('finance.coupon_channel')}: {selected.payments[0].coupon.channel}</span>}
                                    </p>
                                )}
                            </div>
                            <button onClick={closeModal} className="admin-action-btn bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"><X size={22} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-brand-navy-dark flex flex-col items-center justify-center relative">
                            {receiptLoading ? (
                                <div className="text-center space-y-4">
                                    <div className="admin-tile w-20 h-20 bg-white/10 text-gray-400 mx-auto animate-pulse">
                                        <FileImage size={36} />
                                    </div>
                                    <p className="text-gray-500 font-semibold">{t('finance.receipt_loading')}</p>
                                </div>
                            ) : receiptUrl ? (
                                <>
                                    {selected.receiptFileUrl?.toLowerCase().endsWith('.pdf') ? (
                                        <iframe src={receiptUrl} className="w-full h-[500px] rounded-xl shadow-md border border-white/10" title="PDF Receipt" />
                                    ) : (
                                        <Image src={receiptUrl} alt="Receipt" width={800} height={600} unoptimized className="max-w-full rounded-xl shadow-md border border-white/10" />
                                    )}
                                    <button
                                        onClick={() => downloadProtectedFile(`/enrollments/${selected.id}/receipt`)}
                                        className="absolute top-8 left-8 bg-brand-navy-dark border border-white/10 p-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition text-gray-300 hover:text-white"
                                        title={t('finance.download_receipt')}
                                    >
                                        <Save size={20} />
                                    </button>
                                </>
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className="admin-tile w-20 h-20 bg-white/10 text-gray-400 mx-auto">
                                        <FileImage size={36} />
                                    </div>
                                    <p className="text-gray-500 font-semibold">
                                        {receiptError ? t('finance.receipt_load_failed') : t('finance.no_receipt')}
                                    </p>
                                </div>
                            )}
                            {receiptUrl && (
                                <a href={receiptUrl} target="_blank" rel="noreferrer" className="absolute top-8 right-8 bg-brand-navy-dark border border-white/10 p-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition text-gray-300 hover:text-white">
                                    <ExternalLink size={20} />
                                </a>
                            )}
                        </div>

                        {isRejecting ? (
                            <div className="p-6 border-t border-white/10 bg-brand-navy">
                                <label className="block text-sm font-bold text-gray-300 mb-2">{t('finance.reason_label')}</label>
                                <textarea className="w-full border border-white/10 rounded-xl p-4 bg-brand-navy-dark text-white placeholder:text-gray-500 focus:ring-2 focus:ring-red-400 outline-none transition" rows={3} placeholder={t('finance.reason_placeholder')} value={reason} onChange={e => setReason(e.target.value)} />
                                <div className="flex gap-4 mt-4">
                                    <button onClick={() => handleVerify(selected.id, 'REJECTED')} disabled={processing} className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 transition shadow-md shadow-red-500/20">
                                        {processing ? t('common.processing') : t('finance.confirm_rejection')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 border-t border-white/10 bg-brand-navy flex gap-4">
                                <button onClick={() => handleVerify(selected.id, 'APPROVED')} disabled={processing} className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:opacity-90 text-black font-black py-4 rounded-xl shadow-md shadow-brand-gold/25 disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    <Check size={20} /> {t('finance.approve_activate')}
                                </button>
                                <button onClick={() => setIsRejecting(true)} disabled={processing} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-4 rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    <X size={20} /> {t('finance.mark_invalid')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}</>)}

            {activeTab === 'payments' && (
                <>
                    {paymentsError && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{paymentsError}</div>}

                    {paymentsLoading ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('payments.loading')}</div>
                    ) : (
                        <div className="admin-table-wrap animate-fade-in-up">
                            <table className="admin-table text-left">
                                <thead>
                                    <tr>
                                        <th>{t('finance.col_student')}</th>
                                        <th>{t('finance.col_course')}</th>
                                        <th>{t('finance.col_amount')}</th>
                                        <th>{t('admin.col_status')}</th>
                                        <th>{t('finance.col_method')}</th>
                                        <th>{t('finance.col_date')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                    {(payments || []).map(p => (
                                        <tr key={p.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                            <td className="p-4 font-bold text-brand-navy dark:text-gray-200">{p.user?.email || t('finance.unknown_student')}</td>
                                            <td className="p-4 font-bold text-brand-navy dark:text-white">{pick(p.enrollment?.course, 'title') || '—'}</td>
                                            <td className="p-4 font-black text-brand-gold-dark dark:text-brand-gold-light">{formatPrice(p.amount, { locale })}</td>
                                            <td className="p-4">
                                                <Badge tone={statusTone[p.status] || 'gray'} dot>{t('statuses.' + (p.status || '').toLowerCase())}</Badge>
                                            </td>
                                            <td className="p-4">
                                                {p.method ? (
                                                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 dark:text-gray-300">
                                                        <CreditCard size={14} /> {p.method}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600 dark:text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {(payments || []).length === 0 && (
                                        <EmptyState icon={Wallet} title={t('payments.empty_history')} color="blue" />
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'refunds' && (
                <>
                    {refundsError && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{refundsError}</div>}

                    {refundsLoading ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('payments.loading')}</div>
                    ) : (
                        <div className="admin-table-wrap animate-fade-in-up">
                            <table className="admin-table text-left">
                                <thead>
                                    <tr>
                                        <th>{t('finance.col_student')}</th>
                                        <th>{t('finance.col_course')}</th>
                                        <th>{t('refunds.amount')}</th>
                                        <th>{t('refunds.method')}</th>
                                        <th>{t('admin.col_status')}</th>
                                        <th>{t('finance.col_date')}</th>
                                        <th className="text-right">{t('finance.col_actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                    {(refunds || []).map(r => (
                                        <tr key={r.id} className="animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5">
                                            <td className="p-4">
                                                <div className="font-bold text-brand-navy dark:text-gray-200">{r.student?.email || t('finance.unknown_student')}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-brand-navy dark:text-white">{pick(r.course, 'title') || '—'}</div>
                                                {pick(r.opening, 'name') && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{pick(r.opening, 'name')}</div>}
                                            </td>
                                            <td className="p-4 font-black text-brand-gold-dark dark:text-brand-gold-light">{formatPrice(Number(r.amount), { currency: r.currency, locale })}</td>
                                            <td className="p-4">
                                                <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{r.method === 'WALLET' ? t('refunds.method_wallet') : t('refunds.method_bank')}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.accountName}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all" dir="ltr">{r.accountNumber}</div>
                                            </td>
                                            <td className="p-4">
                                                <Badge tone={statusTone[r.status] || 'gray'} dot>{t('statuses.' + (r.status || '').toLowerCase())}</Badge>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                                            <td className="p-4 text-right whitespace-nowrap">
                                                <button onClick={() => openRefund(r)} className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 px-3.5 py-2 rounded-lg text-sm font-bold transition">
                                                    <FileImage size={16} /> {t('refunds.review')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(refunds || []).length === 0 && (
                                        <EmptyState icon={RotateCcw} title={t('refunds.empty')} color="blue" />
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'refunds' && selectedRefund && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-brand-navy border border-white/10 rounded-3xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center gap-4 bg-gradient-to-r from-brand-navy to-brand-navy-dark">
                            <div className="min-w-0">
                                <h3 className="text-xl font-black text-white">{refundRejecting ? t('refunds.reject_title') : t('refunds.review_title')}</h3>
                                <p className="text-sm text-gray-400 mt-1 min-w-0">
                                    {t('finance.student_label')} <span className="font-bold text-white break-all">{selectedRefund.student?.email}</span>
                                </p>
                            </div>
                            <button onClick={closeRefund} className="admin-action-btn bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"><X size={22} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-brand-navy-dark space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-300">
                                <span>{t('finance.col_course')}: <strong className="text-white">{pick(selectedRefund.course, 'title')}</strong></span>
                                <span>{t('refunds.amount')}: <strong className="text-brand-gold-light">{formatPrice(Number(selectedRefund.amount), { currency: selectedRefund.currency, locale })}</strong></span>
                                <span>{t('refunds.method')}: <strong className="text-white">{selectedRefund.method === 'WALLET' ? t('refunds.method_wallet') : t('refunds.method_bank')}</strong></span>
                                <span>{t('refunds.account_holder')}: <strong className="text-white">{selectedRefund.accountName}</strong></span>
                                <span className="break-all">{t('refunds.account_number')}: <strong className="text-white font-mono">{selectedRefund.accountNumber}</strong></span>
                            </div>
                            {selectedRefund.studentNote && (
                                <p className="text-sm text-gray-400"><strong className="text-gray-200">{t('refunds.note')}:</strong> {selectedRefund.studentNote}</p>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">{t('refunds.registration_receipt')}</label>
                                {refundReceiptLoading ? (
                                    <div className="text-gray-500 font-semibold">{t('finance.receipt_loading')}</div>
                                ) : refundReceiptUrl ? (
                                    (selectedRefund.payment?.receiptFileUrl || '').toLowerCase().endsWith('.pdf') ? (
                                        <iframe src={refundReceiptUrl} className="w-full h-[420px] rounded-xl shadow-md border border-white/10" title="Refund Receipt" />
                                    ) : (
                                        <Image src={refundReceiptUrl} alt="Receipt" width={800} height={600} unoptimized className="max-w-full rounded-xl shadow-md border border-white/10" />
                                    )
                                ) : (
                                    <p className="text-sm text-gray-500">{refundReceiptError || t('finance.no_receipt')}</p>
                                )}
                            </div>
                        </div>
                        {refundRejecting ? (
                            <div className="p-6 border-t border-white/10 bg-brand-navy">
                                <label className="block text-sm font-bold text-gray-300 mb-2">{t('finance.reason_label')}</label>
                                <textarea className="w-full border border-white/10 rounded-xl p-4 bg-brand-navy-dark text-white placeholder:text-gray-500 focus:ring-2 focus:ring-red-400 outline-none transition" rows={3} placeholder={t('finance.reason_placeholder')} value={refundReason} onChange={e => setRefundReason(e.target.value)} />
                                <div className="flex gap-4 mt-4">
                                    <button onClick={() => reviewRefund('REJECTED')} disabled={refundProcessing} className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 transition">
                                        {refundProcessing ? t('common.processing') : t('refunds.confirm_reject')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 border-t border-white/10 bg-brand-navy flex gap-4">
                                <button onClick={() => reviewRefund('APPROVED')} disabled={refundProcessing || selectedRefund.status !== 'PENDING'} className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:opacity-90 text-black font-black py-4 rounded-xl shadow-md shadow-brand-gold/25 disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    <Check size={20} /> {t('refunds.approve')}
                                </button>
                                <button onClick={() => setRefundRejecting(true)} disabled={refundProcessing || selectedRefund.status !== 'PENDING'} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-4 rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    <X size={20} /> {t('refunds.reject')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
