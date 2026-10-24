import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
    title: 'Refund Policy | Laxalab',
    description: 'The rules and conditions for refunding course payments on Laxalab.',
};

export default function RefundPolicyPage() {
    return (
        <LegalPage
            titleAr="سياسة الاسترداد"
            titleEn="Refund Policy"
            updatedAr="آخر تحديث: أغسطس 2026"
            updatedEn="Last updated: August 2026"
            introAr="تسعى Laxalab لضمان رضا عملائها. توضح هذه السياسة القواعد المتعلقة باسترداد المبالغ المدفوعة للدورات."
            introEn="Laxalab strives to ensure customer satisfaction. This policy outlines the rules for refunding course payments."
            sections={[
                {
                    titleAr: 'طلب استرداد المبلغ',
                    titleEn: 'Requesting a Refund',
                    bodyAr: 'يتم تقديم طلب الاسترداد من خلال فريق الدعم أو وحدة المالية خلال 7 أيام من تاريخ الدفع، ويكون القرار النهائي بيد الإدارة المالية.',
                    bodyEn: 'Refund requests are submitted through the support team or the finance unit within 7 days of payment, with the final decision resting with the finance management.',
                },
                {
                    titleAr: 'شروط الأهلية للاسترداد',
                    titleEn: 'Refund Eligibility',
                    bodyAr: 'يمكن استرداد المبلغ كاملاً إذا لم تبدأ الدورة بعد أو إذا لم يتم استهلاك الجزء الأكبر من المحتوى التعليمي.',
                    bodyEn: 'A full refund is possible if the course has not started yet or if the majority of the educational content has not been consumed.',
                    itemsAr: ['الانسحاب قبل بدء الدورة: استرداد كامل.', 'الانسحاب بعد بدء الدورة بأقل من 20٪ من المحتوى: استرداد جزئي.', 'بعد استهلاك أكثر من 50٪: لا يُقبل الاسترداد.'],
                    itemsEn: ['Withdrawal before the course starts: full refund.', 'Withdrawal within the first 20% of content: partial refund.', 'After consuming more than 50%: no refund.'],
                },
                {
                    titleAr: 'طريقة الاسترداد',
                    titleEn: 'Refund Method',
                    bodyAr: 'يتم رد المبالغ بنفس وسيلة الدفع الأصلية خلال مدة أقصاها 14 يوماً من الموافقة على الطلب.',
                    bodyEn: 'Refunds are issued to the original payment method within a maximum of 14 days from approval of the request.',
                },
                {
                    titleAr: 'حالات استثنائية',
                    titleEn: 'Exceptions',
                    bodyAr: 'لا تشمل سياسة الاسترداد المنتجات الرقمية المنزّلة أو الدورات المكتملة أو الشهادات الصادرة.',
                    bodyEn: 'The refund policy does not cover downloaded digital products, completed courses, or issued certificates.',
                },
            ]}
        />
    );
}