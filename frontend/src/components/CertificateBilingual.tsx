"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';

export interface CertificateProps {
    studentName: string;
    courseName: string;
    instructorName: string;
    issueDate: string;
    verificationCode: string;
    verificationUrl: string;
    lang: 'ar' | 'en';
}

function formatDate(dateStr: string, lang: 'ar' | 'en'): string {
    const d = new Date(dateStr);
    if (lang === 'en') {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function QRCodeSVG({ url }: { url: string }) {
    const [svg, setSvg] = useState('');
    useEffect(() => {
        QRCode.toString(url, { type: 'svg', width: 90, margin: 1, color: { dark: '#12305A', light: '#ffffff00' } })
            .then(setSvg)
            .catch(() => {});
    }, [url]);
    if (!svg) return <div className="w-[90px] h-[90px] bg-gray-100 animate-pulse rounded" />;
    return <div className="w-[90px] h-[90px]" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function GoldDiamond() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block mx-1">
            <rect x="6" y="0" width="8.5" height="8.5" transform="rotate(45 6 0)" fill="#C6A15B" />
        </svg>
    );
}

function OrnamentLine({ side }: { side: 'left' | 'right' }) {
    return (
        <div className={`flex items-center gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
            <div className="h-[1px] w-8 bg-[#C6A15B]/40" />
            <div className="w-1.5 h-1.5 rotate-45 bg-[#C6A15B]/60" />
            <div className="h-[1px] w-20 bg-gradient-to-r from-[#C6A15B]/60 to-[#C6A15B]/10" />
        </div>
    );
}

export default function CertificateBilingual({ studentName, courseName, instructorName, issueDate, verificationCode, verificationUrl, lang }: CertificateProps) {
    const isAr = lang === 'ar';
    const [scale, setScale] = useState(1);
    const certRef = useRef<HTMLDivElement>(null);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    useEffect(() => {
        const el = certRef.current;
        if (!el) return;
        const fit = () => {
            const w = el.getBoundingClientRect().width;
            setScale(Math.min(1, w / 1056));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        window.addEventListener('resize', fit);
        return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
    }, []);

    useEffect(() => {
        document.title = isAr
            ? `شهادة إتمام الدورة - ${courseName} | Laxalab`
            : `Certificate of Completion - ${courseName} | Laxalab`;
    }, [isAr, courseName]);

    return (
        <>
            {/* Controls — hidden on print */}
            <div className="no-print fixed top-0 inset-x-0 z-50 bg-brand-navy-dark/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-gold to-brand-gold-dark rounded-lg flex items-center justify-center">
                            <span className="text-black font-black text-sm">L</span>
                        </div>
                        <span className="text-white font-bold text-sm hidden sm:inline">
                            {isAr ? 'شهادة إتمام الدورة' : 'Certificate of Completion'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs hidden sm:inline font-mono" dir="ltr">
                            #{verificationCode.slice(0, 8)}
                        </span>
                        <button
                            onClick={handlePrint}
                            className="bg-white text-brand-navy-dark font-black text-sm px-5 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                            </svg>
                            {isAr ? 'طباعة' : 'Print'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Spacer for fixed header */}
            <div className="no-print h-14" />

            {/* Certificate */}
            <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4 overflow-hidden print:bg-white print:p-0 print:overflow-visible">
                {/* Mobile stacked certificate (screen only, below md) */}
                <div className="md:hidden print:hidden w-full max-w-md mx-auto relative z-10">
                    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl" style={{ border: '8px solid #12305A' }}>
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#C6A15B]" />
                        <div className="p-6 pt-8 text-center space-y-5">
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-9 h-9 bg-[#12305A] rounded-lg flex items-center justify-center">
                                    <span className="text-[#C6A15B] font-black text-lg">L</span>
                                </div>
                                <span className="text-xl font-black text-[#12305A] tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                    laxa<span className="text-[#C6A15B]">lab</span>
                                </span>
                            </div>
                            <div className="h-px mx-8 bg-gradient-to-r from-transparent via-[#C6A15B]/60 to-transparent" />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                    {isAr ? 'شهادة إتمام الدورة' : 'CERTIFICATE OF COMPLETION'}
                                </p>
                                <p className="text-sm text-gray-500 italic">{isAr ? 'تُمنح هذه الشهادة إلى' : 'This is to certify that'}</p>
                                <p className="text-2xl font-bold text-[#12305A] mt-1 break-words" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{studentName}</p>
                                <p className="text-sm text-gray-500 italic mt-4">{isAr ? 'وقد أتم بنجاح دورة:' : 'has successfully completed the course:'}</p>
                                <p className="text-lg font-bold text-[#12305A] mt-1 break-words" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{courseName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-start">
                                <div className="bg-[#f8f9fb] border border-[#12305A]/10 rounded-xl p-3">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {isAr ? 'المدرّس المعتمد' : 'Instructor'}
                                    </p>
                                    <p className="text-xs font-bold text-[#12305A] mt-1 break-words" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{instructorName}</p>
                                </div>
                                <div className="bg-[#f8f9fb] border border-[#12305A]/10 rounded-xl p-3">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {isAr ? 'تاريخ الإصدار' : 'Date'}
                                    </p>
                                    <p className="text-xs font-bold text-[#12305A] mt-1" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{formatDate(issueDate, lang)}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-4 border-t border-dashed border-[#12305A]/15 pt-5">
                                <div className="p-1.5 bg-white border border-[#12305A]/10 rounded shadow-sm shrink-0">
                                    <QRCodeSVG url={verificationUrl} />
                                </div>
                                <div className="text-start min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {isAr ? 'رقم الشهادة' : 'Certificate ID'}
                                    </p>
                                    <p className="text-sm font-mono font-black tracking-wider text-[#12305A] break-all" dir="ltr">{verificationCode.toUpperCase()}</p>
                                    <p className="text-[9px] text-gray-400 mt-1 break-all" dir="ltr">{verificationUrl.replace(/^https?:\/\//, '')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div ref={certRef} className="w-full relative print:relative hidden md:block print:block">
                    <div className="print:hidden" style={{ height: `${748 * scale}px` }} />
                    <div
                        className="certificate-wrap bg-white shadow-2xl print:shadow-none print:w-full"
                        style={{
                            position: 'absolute' as const,
                            top: 0,
                            left: 0,
                            width: '1056px',
                            height: '748px',
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                        }}
                    >

                        {/* === DECORATIVE BORDER === */}
                        <div className="absolute inset-0 border-[8px] border-[#12305A]" />
                        <div className="absolute border-[2px] border-[#C6A15B]" style={{ inset: '10px' }} />
                        <div className="absolute border border-[#12305A]/10" style={{ inset: '16px' }} />

                        {/* Corner ornaments — elegant gold dots */}
                        {[
                            { top: '14px', left: '14px' },
                            { top: '14px', right: '14px' },
                            { bottom: '14px', left: '14px' },
                            { bottom: '14px', right: '14px' },
                        ].map((pos, i) => (
                            <div key={i} className="absolute" style={{ ...pos }}>
                                <div className="w-5 h-5 relative">
                                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[1px] bg-[#C6A15B]/50" />
                                    <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-[1px] bg-[#C6A15B]/50" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#C6A15B]" />
                                </div>
                            </div>
                        ))}

                        {/* === CONTENT === */}
                        <div
                            className="relative h-full flex flex-col items-center justify-between"
                            style={{ inset: '24px', position: 'absolute', padding: isAr ? '40px 48px 32px' : '40px 48px 32px' }}
                        >

                            {/* ===== TOP SECTION: Logo + Title ===== */}
                            <div className="text-center w-full">
                                {/* Logo + Brand */}
                                <div className={`flex items-center justify-center gap-3 mb-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                                    <div className="w-12 h-12 bg-[#12305A] rounded-lg flex items-center justify-center shadow-sm">
                                        <span className="text-[#C6A15B] font-black text-xl">L</span>
                                    </div>
                                    <h1 className="text-2xl font-black text-[#12305A] tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        laxa<span className="text-[#C6A15B]">lab</span>
                                    </h1>
                                </div>

                                {/* Decorative line */}
                                <div className="flex items-center justify-center gap-3 mb-3">
                                    <OrnamentLine side="left" />
                                    <GoldDiamond />
                                    <OrnamentLine side="right" />
                                </div>

                                {/* Certificate Title */}
                                <h2
                                    className="text-[11px] font-bold uppercase tracking-[0.4em] mb-1"
                                    style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}
                                >
                                    {isAr ? 'شهادة إتمام الدورة' : 'Certificate of Completion'}
                                </h2>
                            </div>

                            {/* ===== MIDDLE SECTION: Body ===== */}
                            <div className={`text-center flex-1 flex flex-col items-center justify-center w-full max-w-xl ${isAr ? 'direction-rtl' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>

                                {/* "This is to certify that" */}
                                <p
                                    className="text-[13px] mb-4"
                                    style={{ color: '#6b7280', fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: 'italic' }}
                                >
                                    {isAr ? 'تُمنح هذه الشهادة إلى' : 'This is to certify that'}
                                </p>

                                {/* === Student Name (large, underlined) === */}
                                <div className="mb-2">
                                    <p
                                        className="text-[38px] leading-tight mb-1"
                                        style={{
                                            color: '#12305A',
                                            fontFamily: "'Georgia', 'Times New Roman', serif",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {studentName}
                                    </p>
                                    <div className="w-80 h-[1.5px] mx-auto bg-gradient-to-r from-transparent via-[#C6A15B]/70 to-transparent" />
                                </div>

                                {/* "has successfully completed" */}
                                <p
                                    className="text-[13px] mt-3 mb-2"
                                    style={{ color: '#6b7280', fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: 'italic' }}
                                >
                                    {isAr ? 'وقد أتم بنجاح دورة' : 'has successfully completed the course'}
                                </p>

                                {/* === Course Name === */}
                                <p
                                    className="text-[22px] font-bold mb-3"
                                    style={{
                                        color: '#12305A',
                                        fontFamily: "'Georgia', 'Times New Roman', serif",
                                    }}
                                >
                                    {courseName}
                                </p>

                                {/* Description */}
                                <p
                                    className="text-[11px] leading-relaxed max-w-md mb-4"
                                    style={{ color: '#9ca3af', fontFamily: "'Georgia', 'Times New Roman', serif" }}
                                >
                                    {isAr
                                        ? 'بما في ذلك جميع المتطلبات الدراسية والتمارين العملية والاختبارات التقييمية اللازمة لإتمام الدورة بنجاح.'
                                        : 'including all coursework, practical assignments, and assessments required for successful completion.'}
                                </p>

                                {/* Certificate Number */}
                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded border border-[#12305A]/10 bg-[#f8f9fb] ${isAr ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {isAr ? 'رقم الشهادة' : 'Certificate ID'}
                                    </span>
                                    <span className="text-[10px] font-mono font-black tracking-wider" style={{ color: '#12305A' }} dir="ltr">
                                        {verificationCode.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* ===== BOTTOM SECTION: Signatures + QR + Date ===== */}
                            <div className={`w-full flex items-end justify-between gap-6 ${isAr ? 'flex-row-reverse' : ''}`} dir="ltr">

                                {/* Left: Instructor Signature */}
                                <div className="flex-1 text-center" dir={isAr ? 'rtl' : 'ltr'}>
                                    <p
                                        className="text-[14px] italic mb-1"
                                        style={{
                                            color: '#12305A',
                                            fontFamily: "'Georgia', 'Times New Roman', serif",
                                        }}
                                    >
                                        {instructorName}
                                    </p>
                                    <div className="w-full h-[1px] bg-[#12305A]/20 mb-1" />
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {isAr ? 'المدرّس المعتمد' : 'Certified Instructor'}
                                    </p>
                                </div>

                                {/* Center: QR Code + Laxalab Seal */}
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="p-1.5 bg-white border border-[#12305A]/10 rounded shadow-sm">
                                        <QRCodeSVG url={verificationUrl} />
                                    </div>
                                    <p className="text-[7px] font-mono font-bold tracking-[0.15em]" style={{ color: '#aaa' }}>
                                        {isAr ? 'امسح للتحقق' : 'SCAN TO VERIFY'}
                                    </p>
                                </div>

                                {/* Right: Date + Platform */}
                                <div className="flex-1 text-center" dir={isAr ? 'rtl' : 'ltr'}>
                                    <p className="text-[12px] font-bold mb-1" style={{ color: '#12305A', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {formatDate(issueDate, lang)}
                                    </p>
                                    <div className="w-full h-[1px] bg-[#12305A]/20 mb-1" />
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8B7355', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                        {isAr ? 'تاريخ الإصدار' : 'Date of Issue'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    @page { size: landscape; margin: 0; }
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .no-print { display: none !important; }
                    .certificate-wrap { box-shadow: none !important; width: 100% !important; margin: 0 !important; position: relative !important; transform: none !important; height: 748px !important; }
                    .min-h-screen { background: white !important; padding: 0 !important; display: block !important; }
                    .min-h-screen > div { margin: 0 !important; }
                }
            `}</style>
        </>
    );
}
