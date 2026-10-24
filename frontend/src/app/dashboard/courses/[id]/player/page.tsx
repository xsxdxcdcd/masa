"use client";

import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import CoursePlayer from '@/components/CoursePlayer';

export default function LessonPlayerPage() {
    const { id } = useParams();
    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <CoursePlayer courseId={String(id)} />
        </ProtectedRoute>
    );
}