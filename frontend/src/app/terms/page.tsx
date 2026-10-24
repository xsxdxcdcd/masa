import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
    title: 'Terms of Service | Laxalab',
    description: 'The terms and conditions governing the use of the Laxalab learning and certification platform.',
};

export default function TermsPage() {
    return (
        <LegalPage
            titleAr="الشروط والأحكام"
            titleEn="Terms of Service"
            updatedAr="آخر تحديث: أغسطس 2026"
            updatedEn="Last updated: August 2026"
            introAr="مرحباً بك في منصة Laxalab التعليمية. باستخدامك للمنصة فإنك توافق على الشروط والأحكام التالية."
            introEn="Welcome to the Laxalab learning platform. By using the platform you agree to the following terms and conditions."
            sections={[
                {
                    titleAr: 'حسابك ومسؤولياتك',
                    titleEn: 'Your Account & Responsibilities',
                    bodyAr: 'أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك وعن جميع الأنشطة التي تحدث من خلال حسابك.',
                    bodyEn: 'You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.',
                    itemsAr: ['تقديم معلومات دقيقة عند التسجيل.', 'إخطارنا فوراً بأي استخدام غير مصرح به لحسابك.', 'عدم نقل حسابك لأي طرف آخر.'],
                    itemsEn: ['Provide accurate information when registering.', 'Notify us immediately of any unauthorized use of your account.', 'Do not transfer your account to any other party.'],
                },
                {
                    titleAr: 'المحتوى والاشتراكات',
                    titleEn: 'Content & Enrollments',
                    bodyAr: 'تخول منصة Laxalab الحق في الوصول إلى الدورات والمواد التعليمية المسجَّل فيها. يحظر إعادة نشر محتوى المنصة دون إذن كتابي.',
                    bodyEn: 'Laxalab grants you access to the courses and materials you are enrolled in. Republishing platform content without written permission is prohibited.',
                },
                {
                    titleAr: 'سلوك المستخدم',
                    titleEn: 'User Conduct',
                    bodyAr: 'لا يجوز استخدام المنصة لأي غرض غير قانوني أو بطرق تلحق الضرر بالمنصة أو مستخدميها الآخرين.',
                    bodyEn: 'You may not use the platform for any unlawful purpose or in ways that harm the platform or its other users.',
                    itemsAr: ['عدم التحرش أو إساءة استعمال المحتوى.', 'عدم محاولة الوصول غير المصرح به إلى أنظمة المنصة.'],
                    itemsEn: ['No harassment or abusive use of content.', 'No attempts to gain unauthorized access to platform systems.'],
                },
                {
                    titleAr: 'إنهاء الخدمة',
                    titleEn: 'Termination',
                    bodyAr: 'تحتفظ Laxalab بالحق في تعليق أو إنهاء حساب أي مستخدم يخالف هذه الشروط أو القوانين المعمول بها.',
                    bodyEn: 'Laxalab reserves the right to suspend or terminate any account that violates these terms or applicable laws.',
                },
                {
                    titleAr: 'تعديل الشروط',
                    titleEn: 'Changes to These Terms',
                    bodyAr: 'قد نحدّث هذه الشروط من وقت لآخر، وسيُعتبر استمرار استخدامك للمنصة قبولاً بالتعديلات الجديدة.',
                    bodyEn: 'We may update these terms from time to time and continued use of the platform constitutes acceptance of the updated terms.',
                },
            ]}
        />
    );
}