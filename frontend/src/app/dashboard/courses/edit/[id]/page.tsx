"use client";

import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import CourseForm from '@/components/CourseForm';

export default function EditCoursePage() {
    const { id } = useParams();
    return (
        <ProtectedRoute allowedRoles={['ADMIN', 'COURSE_MANAGER']}>
            <CourseForm courseId={String(id)} />
        </ProtectedRoute>
    );
}