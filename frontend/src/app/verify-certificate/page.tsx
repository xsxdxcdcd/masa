import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyCertificateForm from './VerifyCertificateForm.client';

export const metadata: Metadata = {
    title: 'Verify Certificate | Laxalab',
    description: 'Verify the authenticity of a Laxalab course certificate using its unique verification code.',
    openGraph: { title: 'Verify Certificate | Laxalab', description: 'Verify a Laxalab certificate of achievement.' },
};

export default function VerifyCertificatePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-brand-navy-dark flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-brand-gold dark:border-white/10 dark:border-t-brand-gold-light rounded-full animate-spin" />
            </div>
        }>
            <VerifyCertificateForm />
        </Suspense>
    );
}
