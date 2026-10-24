"use client";

import { useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { AlertTriangle, CheckCircle2, CreditCard, ImageIcon, PlayCircle, X } from 'lucide-react';

export interface PaymentGateway {
    id: string;
    name: string;
    instructions: string;
    guideImages?: string[] | null;
    guideVideoUrl?: string | null;
}

/** Media paths are stored relative (e.g. /uploads/payments/...) so they stay portable. */
export const mediaUrl = (url?: string | null): string | null => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface Props {
    gateways?: PaymentGateway[] | null;
    loading?: boolean;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    dark?: boolean;
    /** Message shown instead of the list when the admin has not configured any method. */
    emptyLabel: string;
}

export default function PaymentMethods({
    gateways,
    loading,
    selectedId,
    onSelect,
    dark = false,
    emptyLabel,
}: Props) {
    const { t } = useI18n();
    const [zoom, setZoom] = useState<string | null>(null);

    if (loading) {
        return (
            <div className="space-y-3" aria-busy="true">
                {[0, 1].map(i => (
                    <div key={i} className={`h-16 rounded-xl animate-pulse ${dark ? 'bg-white/5' : 'bg-brand-mist/50'}`} />
                ))}
            </div>
        );
    }

    if (!gateways || gateways.length === 0) {
        return (
            <div className={`text-sm p-3 rounded-xl border flex items-center gap-2 ${dark ? 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20' : 'text-yellow-700 bg-yellow-50 border-yellow-100'}`}>
                <AlertTriangle size={16} className="flex-shrink-0" />
                {emptyLabel}
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3" role="radiogroup" aria-label={t('payment.payment_method')}>
                {gateways.map((gateway) => {
                    const selected = gateway.id === selectedId;
                    const images = (Array.isArray(gateway.guideImages) ? gateway.guideImages : []).filter(Boolean);
                    const video = mediaUrl(gateway.guideVideoUrl);

                    return (
                        <div
                            key={gateway.id}
                            className={`rounded-xl border transition ${
                                selected
                                    ? dark
                                        ? 'border-brand-gold bg-brand-gold/10'
                                        : 'border-brand-gold bg-brand-gold/10'
                                    : dark
                                        ? 'bg-white/5 border-white/10'
                                        : 'bg-brand-mist/20 border-brand-mist'
                            }`}
                        >
                            <button
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => onSelect?.(gateway.id)}
                                className="w-full text-start p-4 flex items-start gap-3 cursor-pointer"
                            >
                                <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                    selected ? 'border-brand-gold' : dark ? 'border-gray-600' : 'border-gray-300'
                                }`}>
                                    {selected && <CheckCircle2 size={14} className="text-brand-gold" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={`flex items-center gap-2 font-bold ${dark ? 'text-white' : 'text-brand-navy'}`}>
                                        <CreditCard size={16} className="text-brand-gold flex-shrink-0" />
                                        {gateway.name}
                                    </span>
                                    <span className={`block text-sm whitespace-pre-wrap mt-1 leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {gateway.instructions}
                                    </span>
                                    {(images.length > 0 || video) && (
                                        <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold ${dark ? 'text-brand-gold-light' : 'text-brand-gold-dark'}`}>
                                            {images.length > 0 && <><ImageIcon size={13} /> {t('payment.guide_media')}</>}
                                            {video && <><PlayCircle size={13} /> {t('payment.guide_video')}</>}
                                        </span>
                                    )}
                                </span>
                            </button>

                            {selected && (images.length > 0 || video) && (
                                <div className="px-4 pb-4 space-y-3">
                                    {images.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {images.map((img) => (
                                                <button
                                                    key={img}
                                                    type="button"
                                                    onClick={() => setZoom(mediaUrl(img))}
                                                    className={`group relative aspect-square rounded-lg overflow-hidden border transition cursor-pointer ${
                                                        dark ? 'border-white/10 hover:border-brand-gold' : 'border-gray-200 hover:border-brand-gold'
                                                    }`}
                                                >
                                                    <img
                                                        src={mediaUrl(img) || ''}
                                                        alt={t('payment.guide_media')}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {video && (
                                        <video
                                            src={video}
                                            controls
                                            preload="metadata"
                                            playsInline
                                            className={`w-full rounded-lg border ${dark ? 'border-white/10 bg-black/40' : 'border-gray-200 bg-black'}`}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {zoom && (
                <div
                    className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                    onClick={() => setZoom(null)}
                >
                    <button
                        type="button"
                        onClick={() => setZoom(null)}
                        className="absolute top-5 end-5 text-white hover:text-brand-gold transition cursor-pointer"
                        aria-label={t('common.cancel')}
                    >
                        <X size={30} />
                    </button>
                    <img src={zoom} alt={t('payment.guide_media')} className="max-h-[90vh] max-w-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </>
    );
}
