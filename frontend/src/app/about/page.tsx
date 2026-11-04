import type { Metadata } from 'next';
import AboutContent from './About.client';

export const metadata: Metadata = {
    title: 'About Us',
    description: 'Learn about Laxalab — a bilingual digital learning platform offering practical courses and verifiable certificates.',
};

export default function AboutPage() {
    return <AboutContent />;
}