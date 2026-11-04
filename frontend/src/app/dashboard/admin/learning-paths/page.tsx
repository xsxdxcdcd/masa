'use client';

import LearningPathList from '@/components/LearningPathList';
import { useI18n } from '@/lib/i18n-context';

export default function LearningPathsAdminPage() {
    const { t } = useI18n();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-brand-navy dark:text-white">{t('admin.nav_learning_paths')}</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('admin.learning_paths_subtitle')}
                </p>
            </div>
            <LearningPathList mode="manage" />
        </div>
    );
}
