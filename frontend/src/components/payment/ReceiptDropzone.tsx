"use client";

import { useRef } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { FileImage, UploadCloud, XCircle } from 'lucide-react';

interface Props {
    file: File | null;
    onChange: (file: File | null) => void;
    dark?: boolean;
    disabled?: boolean;
}

export default function ReceiptDropzone({ file, onChange, dark = false, disabled = false }: Props) {
    const { t } = useI18n();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) onChange(e.target.files[0]);
    };

    if (file) {
        return (
            <div className={`rounded-xl p-4 flex items-center justify-between ${dark ? 'bg-white/5 border border-white/10' : 'bg-brand-mist border border-brand-mist/80'}`}>
                <div className="flex items-center space-x-3 rtl:space-x-reverse overflow-hidden">
                    <FileImage size={24} className={`flex-shrink-0 ${dark ? 'text-brand-gold-light' : 'text-brand-navy'}`} />
                    <span className={`font-semibold truncate ${dark ? 'text-gray-200' : 'text-brand-charcoal'}`} dir="ltr">{file.name}</span>
                </div>
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 transition flex-shrink-0 cursor-pointer disabled:opacity-50"
                >
                    <XCircle size={20} />
                </button>
            </div>
        );
    }

    return (
        <div
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center font-semibold transition group ${
                disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : `cursor-pointer ${dark
                        ? 'bg-white/5 border-brand-gold/40 text-white hover:bg-white/10 hover:border-brand-gold'
                        : 'bg-brand-white border-brand-gold/50 text-brand-navy hover:bg-brand-mist/50 hover:border-brand-gold'}`
            }`}
        >
            <UploadCloud size={40} className={`mb-3 text-brand-gold transition-transform ${disabled ? '' : 'group-hover:scale-110'}`} />
            <span>{t('payment.attach_receipt')}</span>
            <span className={`text-xs font-normal mt-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t('explore.supports_formats')}</span>
            <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.pdf"
                disabled={disabled}
            />
        </div>
    );
}
