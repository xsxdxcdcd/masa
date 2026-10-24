import type { Metadata } from 'next';
import CertificateViewClient from './CertificateViewClient';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'Certificate | Laxalab',
        description: 'View and verify a Laxalab course certificate.',
        openGraph: { title: 'Laxalab Certificate', description: 'View this certificate of achievement.' },
    };
}

export default async function CertificatePublicPage({ params }: Props) {
    const { id } = await params;
    return <CertificateViewClient id={id} />;
}
