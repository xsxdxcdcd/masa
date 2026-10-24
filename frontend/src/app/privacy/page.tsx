import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
    title: 'Privacy Policy | Laxalab',
    description: 'How Laxalab collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
    return (
        <LegalPage
            titleAr="سياسة الخصوصية"
            titleEn="Privacy Policy"
            updatedAr="آخر تحديث: أغسطس 2026"
            updatedEn="Last updated: August 2026"
            introAr="تحترم منصة Laxalab خصوصية مستخدميها وتلتزم بحماية بياناتهم الشخصية وفقاً للقوانين والأنظمة المعمول بها."
            introEn="Laxalab respects its users' privacy and is committed to protecting their personal data in accordance with applicable laws and regulations."
            sections={[
                {
                    titleAr: 'البيانات التي نجمعها',
                    titleEn: 'Data We Collect',
                    bodyAr: 'نجمع البيانات التي تقدمها عند التسجيل (البريد الإلكتروني، كلمة المرور، اللغة) والبيانات الناتجة عن استخدامك للمنصة مثل تقدمك في الدورات ومدفوعاتك.',
                    bodyEn: 'We collect the data you provide at registration (email, password, language) and data generated from your platform usage such as course progress and payments.',
                },
                {
                    titleAr: 'كيف نستخدم بياناتك',
                    titleEn: 'How We Use Your Data',
                    bodyAr: 'نستخدم بياناتك لتقديم الخدمات، وتحسين تجربتك، وإرسال إشعارات مهمة، ومعالجة المدفوعات، والامتثال للالتزامات القانونية.',
                    bodyEn: 'We use your data to provide services, improve your experience, send important notifications, process payments, and comply with legal obligations.',
                },
                {
                    titleAr: 'حماية البيانات',
                    titleEn: 'Data Protection',
                    bodyAr: 'نستخدم إجراءات أمنية تقنية وإدارية لحماية بياناتك من الوصول غير المصرح به أو الإفصاح أو التعديل.',
                    bodyEn: 'We use technical and administrative security measures to protect your data from unauthorized access, disclosure, or alteration.',
                },
                {
                    titleAr: 'حقوقك',
                    titleEn: 'Your Rights',
                    bodyAr: 'يحق لك طلب نسخة من بياناتك الشخصية، أو تصحيحها، أو حذفها في أي وقت من خلال صفحة حسابك أو التواصل معنا.',
                    bodyEn: 'You have the right to request a copy of your personal data, correct it, or delete it at any time through your account page or by contacting us.',
                },
                {
                    titleAr: 'مشاركة البيانات',
                    titleEn: 'Data Sharing',
                    bodyAr: 'لا نبيع بياناتك الشخصية لأطراف ثالثة. قد نشارك البيانات الضرورية فقط مع معالجي الخدمات (مثل بوابات الدفع) لتنفيذ الخدمات المطلوبة.',
                    bodyEn: 'We do not sell your personal data to third parties. We may share only necessary data with service processors (such as payment gateways) to deliver requested services.',
                },
            ]}
        />
    );
}