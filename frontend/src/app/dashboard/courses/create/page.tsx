import ProtectedRoute from '@/components/ProtectedRoute';
import CourseForm from '@/components/CourseForm';

export default function CreateCoursePage() {
    return (
        <ProtectedRoute allowedRoles={['ADMIN', 'COURSE_MANAGER']}>
            <CourseForm />
        </ProtectedRoute>
    );
}