"use client";

import { useFetchData } from '@/lib/useFetchData';
import { BookOpen, Search, SlidersHorizontal, X, Sparkles, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { formatNumber, formatPrice } from '@/lib/format';
import CourseCard, { type PublicCourse } from '@/components/CourseCard';
import PaymentMethods, { type PaymentGateway } from '@/components/payment/PaymentMethods';
import ReceiptDropzone from '@/components/payment/ReceiptDropzone';
import EnrollSteps from '@/components/payment/EnrollSteps';
import LoginPromptModal from '@/components/LoginPromptModal';

interface Opening {
    id: string;
    status?: string | null;
    price: string;
}

type Course = PublicCourse;

export default function ExploreCourses({ hideHeader = false, dark }: { hideHeader?: boolean; dark?: boolean }) {
    const { t, pick, locale } = useI18n();
    const { dark: ctxDark } = useTheme();
    // `dark` is an explicit override; without it the surrounding theme wins.
    const isDark = dark ?? ctxDark;
    const { user } = useAuth();
    const router = useRouter();
    const { data: courses, loading, error } = useFetchData<Course[]>('/public/courses');
    const { data: gateways, loading: gatewaysLoading } = useFetchData<PaymentGateway[]>('/payment-gateways');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    // Guests are turned away before `selectedCourse` is set, so the course they
    // were trying to enter is kept here to build the post-login return link.
    const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [gatewayId, setGatewayId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [coupon, setCoupon] = useState<{ name: string; amountOff: number; finalAmount: number } | null>(null);
    const [couponChecking, setCouponChecking] = useState(false);

    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [level, setLevel] = useState('');
    const [contentType, setContentType] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const levelLabel = (lvl?: string | null) => t(`course.level_${String(lvl || 'BEGINNER').toLowerCase()}`);
    const openOpening = (course: Course): Opening | undefined => course.openings?.find(o => o.status === 'OPEN');
    const announcedOpening = (course: Course): Opening | undefined => course.openings?.find(o => o.status === 'ANNOUNCEMENT');
    const currentOpening = (course: Course): Opening | undefined => openOpening(course) ?? announcedOpening(course);

    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const course of courses ?? []) {
            const cat = pick(course, 'category');
            if (cat) set.add(cat);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [courses, pick]);

    const filteredCourses = useMemo(() => {
        if (!courses) return courses;
        const q = query.trim().toLowerCase();
        return courses.filter((course) => {
            if (level && (course.level ?? 'BEGINNER') !== level) return false;
            // Live vs pre-recorded is not a nice-to-have detail: it is the first
            // question a student has ("when do we meet?" / "can I watch now?").
            // A course with no type yet is left out of both buckets rather than
            // filed under a guess.
            if (contentType && (course.contentType ?? '') !== contentType) return false;
            if (category) {
                const cat = pick(course, 'category') ?? '';
                if (!cat || cat !== category) return false;
            }
            if (q) {
                const haystack = [
                    course.titleAr, course.titleEn,
                    course.excerptAr, course.excerptEn,
                    course.categoryAr, course.categoryEn,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [courses, query, category, level, contentType, pick]);

    const hasFilters = !!query.trim() || !!category || !!level || !!contentType;

    const clearFilters = () => { setQuery(''); setCategory(''); setLevel(''); setContentType(''); };

    const handleEnrollClick = (course: Course) => {
        const opening = currentOpening(course);
        if (!opening) return;
        if (!user) {
            setPendingCourse(course);
            setShowLoginPrompt(true);
            return;
        }
        setSelectedCourse(course);
        setReceiptFile(null);
        setGatewayId(null);
        setCouponCode('');
        setCoupon(null);
    };

    const handleReserveClick = async (course: Course) => {
        if (!user) {
            setPendingCourse(course);
            setShowLoginPrompt(true);
            return;
        }
        try {
            await api.post('/enrollments/reserve', { courseId: course.id });
            toast.success(t('courseDetail.seat_reserved'));
            router.push('/dashboard/my-courses');
        } catch (err) {
            toast.error(getErrorMessage(err) || t('courseDetail.reserve_failed'));
        }
    };

    const handleEnrollmentSubmit = async () => {
        if (!selectedCourse) return;
        const opening = currentOpening(selectedCourse);
        if (!opening) return;
        if (!gatewayId) {
            toast.error(t('payment.select_method_first'));
            return;
        }
        if (!receiptFile) {
            toast.error(t('explore.upload_receipt_required'));
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('openingId', opening.id);
            formData.append('gatewayId', gatewayId);
            formData.append('receipt', receiptFile);
            if (couponCode.trim()) formData.append('couponCode', couponCode.trim());

            await api.post('/enrollments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success(t('explore.review_success'));
            setSelectedCourse(null);
            setReceiptFile(null);
            setGatewayId(null);
            setCouponCode('');
            setCoupon(null);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('explore.submit_failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const applyCoupon = async () => {
        if (!selectedCourse || !couponCode.trim()) return;
        const opening = currentOpening(selectedCourse);
        setCouponChecking(true);
        try {
            const res = await api.post('/finance/coupons/validate', {
                code: couponCode.trim(),
                courseId: selectedCourse.id,
                price: opening ? Number(opening.price) : undefined,
            });
            setCoupon({
                name: res.data.name,
                amountOff: Number(res.data.amountOff || 0),
                finalAmount: Number(res.data.finalAmount ?? opening?.price ?? 0),
            });
            toast.success(t('payments.coupon_applied'));
        } catch (err) {
            setCoupon(null);
            toast.error(getErrorMessage(err) || t('payments.coupon_invalid'));
        } finally {
            setCouponChecking(false);
        }
    };

    const selectCls = isDark
        ? "w-full px-4 py-3 bg-white/5 border border-white/10 [color-scheme:dark] rounded-xl font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition cursor-pointer [&>option]:bg-brand-navy"
        : "w-full px-4 py-3 bg-white border border-brand-mist rounded-xl font-semibold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-gold transition cursor-pointer";

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            {!hideHeader && (
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                        <div className={`inline-flex items-center gap-2 font-black text-xs uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-brand-gold-light' : 'text-brand-gold-dark'}`}>
                            <Sparkles size={14} /> {t('landing.explore_courses')}
                        </div>
                        <h1 className={`text-4xl md:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-brand-navy'}`}>{t('explore.heading')}</h1>
                        <p className={`mt-2 text-lg max-w-xl ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('explore.subtitle')}</p>
                    </div>
                    {!loading && courses && (
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black shadow-sm shrink-0 ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-brand-mist text-brand-navy'}`}>
                            <BookOpen size={15} className={isDark ? 'text-brand-gold-light' : 'text-brand-gold-dark'} />
                            {formatNumber(filteredCourses?.length ?? 0, locale)} {t('explore.count_label')}
                        </div>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className={`rounded-2xl border p-4 sticky top-[72px] md:top-20 z-30 backdrop-blur-md space-y-4 ${isDark ? 'bg-brand-navy-dark/90 border-white/10 shadow-lg shadow-black/20' : 'bg-white/90 border-brand-mist shadow-sm'}`}>
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search size={18} className={`absolute start-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('explore.search_placeholder')}
                            className={`w-full ps-12 pe-4 py-3 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition ${isDark ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500' : 'bg-gray-50 border border-brand-mist text-brand-charcoal placeholder:text-gray-500'}`}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters((v) => !v)}
                        className={`md:hidden inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition cursor-pointer ${isDark ? 'bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light' : 'bg-brand-navy text-white'}`}
                    >
                        <SlidersHorizontal size={16} /> {t('common.filter')}
                    </button>
                    <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-3 md:w-auto w-full`}>
                        <div className="flex-1 relative">
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                                <option value="">{t('explore.all_categories')}</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
                            <option value="">{t('explore.all_levels')}</option>
                            {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((lvl) => (
                                <option key={lvl} value={lvl}>{levelLabel(lvl)}</option>
                            ))}
                        </select>
                        <select value={contentType} onChange={(e) => setContentType(e.target.value)} className={selectCls}>
                            <option value="">{t('explore.all_types')}</option>
                            <option value="LIVE">{t('course.content_type_live')}</option>
                            <option value="RECORDED">{t('course.content_type_recorded')}</option>
                        </select>
                    </div>
                </div>
                {hasFilters && (
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${isDark ? 'text-white bg-brand-gold/15 ring-1 ring-brand-gold/25' : 'text-brand-navy bg-brand-gold/15'}`}>
                            <SlidersHorizontal size={12} /> {t('common.filter')}: {formatNumber(filteredCourses?.length ?? 0, locale)}
                        </span>
                        <button onClick={clearFilters} className={`inline-flex items-center gap-1 text-xs font-bold transition cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-brand-navy'}`}>
                            <X size={12} /> {t('common.cancel')}
                        </button>
                    </div>
                )}
            </div>

            {error && <div className={`p-4 rounded-lg font-semibold ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600'}`}>{error}</div>}

            {loading ? (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={`rounded-3xl overflow-hidden animate-pulse ${isDark ? 'bg-brand-navy border border-white/5' : 'bg-white border border-brand-mist'}`}>
                            <div className={`h-52 ${isDark ? 'bg-white/10' : 'bg-brand-mist/70'}`} />
                            <div className="p-6 space-y-3">
                                <div className={`h-4 w-1/3 rounded-full ${isDark ? 'bg-white/10' : 'bg-brand-mist'}`} />
                                <div className={`h-6 w-3/4 rounded-full ${isDark ? 'bg-white/10' : 'bg-brand-mist'}`} />
                                <div className={`h-4 w-full rounded-full ${isDark ? 'bg-white/5' : 'bg-brand-mist/60'}`} />
                                <div className={`h-4 w-2/3 rounded-full ${isDark ? 'bg-white/5' : 'bg-brand-mist/60'}`} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                    {filteredCourses?.map((course) => (
                        <CourseCard
                            key={course.id}
                            course={course}
                            isDark={isDark}
                            onEnroll={handleEnrollClick}
                            onReserve={handleReserveClick}
                        />
                    ))}

                    {filteredCourses?.length === 0 && (
                        <div className={`col-span-full py-20 text-center rounded-3xl border border-dashed ${isDark ? 'bg-brand-navy border-white/10 text-gray-400' : 'bg-white border-brand-mist text-gray-500 border-2 border-dashed border-brand-mist/70'}`}>
                            <BookOpen size={48} className={`mx-auto mb-4 ${isDark ? 'text-brand-gold-light/50' : 'text-brand-gold-dark/50'}`} />
                            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-navy'}`}>{hasFilters ? t('explore.no_results') : t('explore.no_courses')}</p>
                            {hasFilters && (
                                <button onClick={clearFilters} className={`mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition cursor-pointer ${isDark ? 'bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light' : 'bg-brand-navy text-white hover:bg-brand-charcoal'}`}>
                                    <X size={15} /> {t('common.cancel')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Login Prompt Modal (guests only) */}
            <LoginPromptModal
                open={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                redirectTo={pendingCourse ? `/courses/${pendingCourse.id}` : undefined}
            />

            {/* Enrollment Modal with Receipt Upload */}
            {selectedCourse && (
                <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`rounded-3xl w-full max-w-lg p-8 shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto animate-scale-in ${isDark ? 'bg-brand-navy border border-white/10' : 'bg-white'}`}>
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-gold/25 to-brand-gold/10 rounded-2xl flex items-center justify-center mb-4 text-brand-gold">
                            <BookOpen size={24} />
                        </div>
                        <h2 className={`text-2xl font-black mb-2 ${isDark ? 'text-white' : 'text-brand-navy'}`}>{t('explore.enroll_in')} {pick(selectedCourse, 'title')}</h2>
                        <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{t('explore.transfer_part1')} <strong className={isDark ? 'text-brand-gold-light' : 'text-brand-navy'}>{formatPrice(currentOpening(selectedCourse)?.price, { locale })}</strong> {t('explore.transfer_part2')}</p>

                        <div className="mb-6">
                            <label className={`block text-sm font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-300' : 'text-brand-charcoal'}`}>
                                {t('payments.coupon_label')}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    value={couponCode}
                                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); }}
                                    placeholder={t('payments.coupon_placeholder')}
                                    className={`flex-1 px-4 py-3 rounded-xl font-mono font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition ${isDark ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-600' : 'bg-white border border-brand-mist text-brand-charcoal placeholder:text-gray-500'}`}
                                />
                                <button
                                    onClick={applyCoupon}
                                    disabled={couponChecking || !couponCode.trim()}
                                    className={`px-4 py-3 rounded-xl font-bold transition disabled:opacity-50 whitespace-nowrap cursor-pointer ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-brand-mist text-brand-charcoal hover:bg-gray-200'}`}
                                >
                                    {couponChecking ? t('common.processing') : t('payments.coupon_apply')}
                                </button>
                            </div>
                            {coupon && (
                                <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-sm">
                                    <div className="flex items-center justify-between text-emerald-500 font-bold">
                                        <span>{coupon.name}</span>
                                        <button onClick={() => { setCoupon(null); setCouponCode(''); }} className="text-xs font-bold underline">
                                            {t('payments.coupon_remove')}
                                        </button>
                                    </div>
                                    <div className={`flex items-center justify-between mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        <span>{t('payments.coupon_discount')}</span>
                                        <span className="font-bold text-emerald-500">-{formatPrice(coupon.amountOff, { locale })}</span>
                                    </div>
                                    <div className={`flex items-center justify-between mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        <span>{t('payments.coupon_total')}</span>
                                        <span className={`font-black ${isDark ? 'text-white' : 'text-brand-navy'}`}>{formatPrice(coupon.finalAmount, { locale })}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <EnrollSteps step={gatewayId ? 2 : 1} dark={isDark} />

                        <div className="mb-6 space-y-3">
                            <h3 className={`font-bold text-sm uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-brand-charcoal'}`}>{t('payment.payment_method')}:</h3>
                            <p className={`text-xs -mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('payment.choose_method_hint')}</p>
                            <PaymentMethods
                                gateways={gateways}
                                loading={gatewaysLoading}
                                selectedId={gatewayId}
                                onSelect={(id) => setGatewayId(prev => (prev === id ? null : id))}
                                dark={isDark}
                                emptyLabel={t('explore.no_payment_methods')}
                            />
                        </div>

                        <div className="space-y-3">
                            <h3 className={`font-bold text-sm uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-brand-charcoal'}`}>{t('payment.step_receipt')}:</h3>
                            {!gatewayId ? (
                                <p className={`text-sm p-3 rounded-xl border flex items-center gap-2 ${isDark ? 'text-gray-400 bg-white/5 border-white/10' : 'text-gray-600 bg-brand-mist/40 border-brand-mist'}`}>
                                    <AlertTriangle size={16} className="flex-shrink-0 text-brand-gold" />
                                    {t('payment.receipt_section_locked')}
                                </p>
                            ) : (
                                <ReceiptDropzone file={receiptFile} onChange={setReceiptFile} dark={isDark} disabled={isSubmitting} />
                            )}
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleEnrollmentSubmit}
                                disabled={isSubmitting || !receiptFile || !gatewayId}
                                className="flex-1 bg-brand-gold hover:bg-brand-gold/90 text-brand-navy py-3.5 font-bold rounded-2xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? t('common.submitting') : t('explore.submit_proof')}
                            </button>
                            <button
                                onClick={() => setSelectedCourse(null)}
                                disabled={isSubmitting}
                                className={`flex-1 py-3.5 font-bold rounded-2xl transition cursor-pointer ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-brand-mist text-brand-charcoal hover:bg-gray-200'}`}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}