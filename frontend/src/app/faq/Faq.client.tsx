"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import MarketingShell from '@/components/MarketingShell';

const FAQS = [
    {
        qAr: 'كيف أسجل في منصة Laxalab؟',
        qEn: 'How do I sign up on Laxalab?',
        aAr: 'اضغط على زر "إنشاء حساب" وأدخل بريدك الإلكتروني وكلمة مرور قوية. ستحتاج إلى تفعيل بريدك عبر الرسالة التي نرسلها إليك، ثم يمكنك تسجيل الدخول مباشرة والبدء في تصفح الدورات.',
        aEn: 'Click the "Register" button and enter your email and a strong password. You will need to activate your email via the message we send you, then you can sign in and start browsing courses.',
    },
    {
        qAr: 'كيف تعمل الدورات؟',
        qEn: 'How do the courses work?',
        aAr: 'تنقسم كل دورة إلى وحدات ومواد دراسية متسلسلة. يمكنك متابعة تقدمك، وإنجاز الواجبات والاختبارات، والتواصل مع المدرّب والطلاب من خلال منتدى الدورة. بعض الدورات تشمل جلسات مباشرة حسب الدفعة التي تلتحق بها.',
        aEn: 'Every course is split into sequential modules and study materials. You can track your progress, complete assignments and quizzes, and interact with your instructor and peers through the course forum. Some courses include live sessions depending on the cohort you join.',
    },
    {
        qAr: 'هل أحصل على شهادة بعد إتمام الدورة؟',
        qEn: 'Will I receive a certificate after completing a course?',
        aAr: 'نعم. عند إتمام متطلبات الدورة بنجاح، تُصدر منصة Laxalab شهادة إتمام برمز تحقق فريد يمكن لأي جهة خارجية التحقق من صحته عبر صفحة "التحقق من الشهادة".',
        aEn: 'Yes. Once you successfully complete the course requirements, Laxalab issues a completion certificate with a unique verification code that any third party can validate via the "Verify a Certificate" page.',
    },
    {
        qAr: 'ما هي طرق الدفع المقبولة؟',
        qEn: 'Which payment methods are accepted?',
        aAr: 'يقبل الموقع الدفع عبر البطاقات الائتمانية والخصم المباشر، ومدى إذا كان متاحاً في منطقتك. تُعرض أسعار كل دفعة بعملتها (عادةً الريال السعودي أو الدولار) قبل إتمام عملية الدفع.',
        aEn: 'The platform accepts credit and debit cards, and Mada where available in your region. Each cohort’s price is shown in its currency (usually SAR or USD) before you complete the payment.',
    },
    {
        qAr: 'هل يمكنني استرداد المبلغ في حال لم تناسبني الدورة؟',
        qEn: 'Can I get a refund if a course is not right for me?',
        aAr: 'نعم، وفق سياسة الاسترداد الموضحة في "سياسة الاسترداد". يمكنك التقدم بطلب استرداد خلال الفترة المسموحة، وسنعالج الطلب وفق الشروط المعلنة.',
        aEn: 'Yes, following the refund policy described on the "Refund Policy" page. You can apply for a refund within the allowed period, and we will process it according to the stated terms.',
    },
    {
        qAr: 'كيف أتواصل مع فريق الدعم؟',
        qEn: 'How do I reach the support team?',
        aAr: 'يمكنك استخدام صفحة "تواصل معنا" لإرسال رسالتك، أو إنشاء تذكرة دعم من داخل لوحة التحكم. نرد عادةً خلال 24 إلى 48 ساعة عمل.',
        aEn: 'You can send a message through the "Contact" page, or open a support ticket from inside your dashboard. We typically respond within 24–48 business hours.',
    },
];

export default function FaqContent() {
    const { locale } = useI18n();
    const { dark } = useTheme();
    const isAr = locale === 'ar';
    const [open, setOpen] = useState<number | null>(0);

    return (
        <MarketingShell
            title={isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
            subtitle={isAr ? 'إجابات مباشرة على أكثر الأسئلة تكراراً. لم تجد ما تبحث عنه؟ تواصل معنا.' : 'Straight answers to the most common questions. Can’t find what you’re looking for? Contact us.'}
        >
            <div className="space-y-4">
                {FAQS.map((faq, i) => {
                    const isOpen = open === i;
                    return (
                        <div key={i} className={`rounded-2xl border shadow-sm overflow-hidden ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                            <button
                                onClick={() => setOpen(isOpen ? null : i)}
                                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                                aria-expanded={isOpen}
                            >
                                <span className={`font-bold ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? faq.qAr : faq.qEn}</span>
                                <ChevronDown size={20} className={`text-brand-gold shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                                <div className={`px-6 pb-6 leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{isAr ? faq.aAr : faq.aEn}</div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className={`mt-12 rounded-3xl border p-8 text-center ${dark ? 'bg-white/5 border-white/10' : 'bg-brand-mist/40 border-gray-200'}`}>
                <h2 className={`text-xl font-black mb-2 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'لم تجد إجابتك؟' : 'Still have a question?'}</h2>
                <p className={`mb-6 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{isAr ? 'فريقنا جاهز لمساعدتك في أي وقت.' : 'Our team is ready to help you any time.'}</p>
                <Link href="/contact" className="inline-block bg-brand-gold text-brand-navy-dark px-8 py-3.5 rounded-xl font-black hover:bg-brand-gold-light transition">
                    {isAr ? 'تواصل معنا' : 'Contact Us'}
                </Link>
            </div>
        </MarketingShell>
    );
}