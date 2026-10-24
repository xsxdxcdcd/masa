import type { Metadata } from 'next';
import AboutContent from './About.client';

export const metadata: Metadata = {
    title: 'About Us',
    description: 'Learn about Laxalab — a bilingual digital learning platform delivering practical courses with accredited certificates.',
};

export default function AboutPage() {
    return <AboutContent />;
}