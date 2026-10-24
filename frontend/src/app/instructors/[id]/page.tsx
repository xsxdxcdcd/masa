import type { Metadata } from 'next';
import InstructorProfileContent from './InstructorProfile.client';

type Props = {
    params: Promise<{ id: string }>;
};

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Instructor Profile',
    description: 'Explore a Laxalab instructor’s profile and their available courses.',
};

export default async function InstructorProfilePage({ params }: Props) {
    const { id } = await params;
    return <InstructorProfileContent id={id} />;
}