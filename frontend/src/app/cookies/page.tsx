import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
    title: 'Cookie Policy | Laxalab',
    description: 'How Laxalab uses cookies to improve your experience on the platform.',
};

export default function CookiesPage() {
    return (
        <LegalPage
            titleAr="سياسة ملفات الارتباط (الكوكيز)"
            titleEn="Cookie Policy"
            updatedAr="آخر تحديث: أغسطس 2026"
            updatedEn="Last updated: August 2026"
            introAr="تستخدم منصة Laxalab ملفات الارتباط لتحسين تجربتك وتحليل استخدام المنصة."
            introEn="Laxalab uses cookies to improve your experience and analyze platform usage."
            sections={[
                {
                    titleAr: 'ما هي ملفات الارتباط؟',
                    titleEn: 'What Are Cookies?',
                    bodyAr: 'ملفات الارتباط هي ملفات نصية صغيرة تُخزَّن على جهازك عند زيارة الموقع وتستخدم لتذكّر تفضيلاتك وإعداداتك.',
                    bodyEn: 'Cookies are small text files stored on your device when you visit the site; they are used to remember your preferences and settings.',
                },
                {
                    titleAr: 'كيف نستخدم ملفات الارتباط',
                    titleEn: 'How We Use Cookies',
                    bodyAr: 'نستخدم ملفات الارتباط الضرورية (مثل حفظ الجلسة واللغة) وملفات الارتباط التحليلية لتحسين خدماتنا.',
                    bodyEn: 'We use necessary cookies (such as session and language) and analytic cookies to improve our services.',
                },
                {
                    titleAr: 'إدارة ملفات الارتباط',
                    titleEn: 'Managing Cookies',
                    bodyAr: 'يمكنك تعديل إعدادات المتصفح لمنع ملفات الارتباط أو حذفها، مع ملاحظة أن بعض ميزات المنصة قد لا تعمل بشكل صحيح.',
                    bodyEn: 'You can adjust your browser settings to block or delete cookies; note that some platform features may not work correctly without them.',
                },
            ]}
        />
    );
}