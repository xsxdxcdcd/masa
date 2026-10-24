import type { Metadata } from 'next';
import FaqContent from './Faq.client';

export const metadata: Metadata = {
    title: 'Frequently Asked Questions',
    description: 'Answers to the most common questions about Laxalab courses, certificates, payments, and support.',
};

export default function FaqPage() {
    return <FaqContent />;
}