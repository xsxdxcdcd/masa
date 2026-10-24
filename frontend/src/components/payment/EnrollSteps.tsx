"use client";

import { useI18n } from '@/lib/i18n-context';

interface Props {
    /** 1 = choose how to pay, 2 = attach the proof of payment. */
    step: 1 | 2;
    dark?: boolean;
}

export default function EnrollSteps({ step, dark = false }: Props) {
    const { t } = useI18n();

    const items = [
        { n: 1, label: t('payment.step_method') },
        { n: 2, label: t('payment.step_receipt') },
    ];

    return (
        <ol className="flex items-center gap-2 mb-6" aria-label={t('payment.payment_method')}>
            {items.map((item, i) => {
                const done = step > item.n;
                const active = step === item.n;
                return (
                    <li key={item.n} className="flex items-center gap-2 flex-1 last:flex-none">
                        <span
                            aria-current={active ? 'step' : undefined}
                            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                                active
                                    ? 'bg-brand-gold text-brand-navy'
                                    : done
                                        ? dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                        : dark ? 'bg-white/5 text-gray-500' : 'bg-brand-mist text-gray-500'
                            }`}
                        >
                            {item.n}
                        </span>
                        <span className={`text-xs font-bold whitespace-nowrap ${active ? (dark ? 'text-white' : 'text-brand-navy') : dark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {item.label}
                        </span>
                        {i === 0 && (
                            <span className={`flex-1 h-px mx-1 ${dark ? 'bg-white/10' : 'bg-gray-200'}`} aria-hidden="true" />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
