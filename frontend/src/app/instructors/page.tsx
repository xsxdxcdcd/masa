import type { Metadata } from 'next';
import InstructorsContent from './Instructors.client';

export const metadata: Metadata = {
    title: 'Our Instructors',
    description: 'Meet the certified Laxalab instructors leading our practical courses in Arabic and English.',
};

export default function InstructorsPage() {
    return <InstructorsContent />;
}