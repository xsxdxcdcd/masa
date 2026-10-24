"use client";

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import MarketingShell from '@/components/MarketingShell';
import { Target, Globe2, Medal, ShieldCheck, Sparkles, HeartHandshake } from 'lucide-react';

const VALUES = [
    { icon: Target, titleAr: 'التعلم العملي', titleEn: 'Hands-on Learning', descAr: 'دورات مبنية على مشاريع واقعية وتطبيق مباشر يضمن إتقان المهارة فعلياً.', descEn: 'Courses built on real-world projects and direct application that ensure skills are truly mastered.' },
    { icon: Globe2, titleAr: 'ثنائية اللغة', titleEn: 'Bilingual by Design', descAr: 'محتوى عربي وإنجليزي أصيل ليصل إلى متعلّمين من كل أنحاء العالم.', descEn: 'Genuinely Arabic and English content that reaches learners everywhere in the world.' },
    { icon: Medal, titleAr: 'شهادات معتمدة', titleEn: 'Accredited Certificates', descAr: 'شهادات ذات رموز تحقق رسمية يمكن أي جهة التحقق من صحتها.', descEn: 'Certificates with official verification codes that any party can validate.' },
    { icon: ShieldCheck, titleAr: 'خصوصية وأمان', titleEn: 'Privacy & Security', descAr: 'نلتزم بأعلى معايير حماية البيانات والامتثال للأنظمة العالمية.', descEn: 'We follow the highest data-protection standards and international compliance.' },
    { icon: Sparkles, titleAr: 'مدربون خبراء', titleEn: 'Expert Instructors', descAr: 'نخبة من المدربين المعتمدين ذوي الخبرة الميدانية في مجالاتهم.', descEn: 'A hand-picked group of certified trainers with real field experience.' },
    { icon: HeartHandshake, titleAr: 'مجتمع داعم', titleEn: 'Supportive Community', descAr: 'منتدى تفاعلي مباشر مع المدرّبين والطلاب لدعم رحلتك التعليمية.', descEn: 'A live forum with instructors and peers that supports your learning journey.' },
];

export default function AboutContent() {
    const { locale } = useI18n();
    const { dark } = useTheme();
    const isAr = locale === 'ar';

    return (
        <MarketingShell
            title={isAr ? 'عن Laxalab' : 'About Laxalab'}
            subtitle={
                isAr
                    ? 'بوابتك نحو التعلّم الرقمي الحديث — نجمع بين الأصالة العربية والمعايير العالمية.'
                    : 'Your gateway to modern digital learning — blending Arabic authenticity with global standards.'
            }
        >
            <section className="space-y-6">
                <h2 className={`text-2xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'قصتنا' : 'Our Story'}</h2>
                <p className={`leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isAr
                        ? 'انطلقت Laxalab من إيمان بسيط: المعرفة لا حدود لها، ويجب أن تكون متاحة للجميع بلغة يفهمونها. منذ بدايتنا، نعمل على بناء منصة تعليمية رقمية تقدم دورات عملية عالية الجودة تغطي التكنولوجيا والأعمال والمهارات الشخصية، بلهجتي العربية والإنجليزية، مع مرونة تناسب المتعلم العربي والمتعلم من أي مكان في العالم.'
                        : 'Laxalab started from a simple belief: knowledge has no borders, and it should be accessible to everyone in a language they understand. From day one, we have been building a digital learning platform that offers practical, high-quality courses across technology, business, and personal skills — in both Arabic and English — with flexibility that suits learners in the Arab world and beyond.'}
                </p>
                <p className={`leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isAr
                        ? 'اليوم، نقدم تجربة تعلم متكاملة تشمل تتبع التقدم، والواجبات، والاختبارات، والإصدار الآلي للشهادات، فضلاً عن مجتمع داعم من المدربين والطلاب. مهمتنا أن نكون الخيار الأول للتعلم الرقمي الناطق بالعربية، دون المساس بالمعايير الدولية للجودة.'
                        : 'Today, we offer a complete learning experience including progress tracking, assignments, quizzes, automated certificate issuance, and a supportive community of instructors and students. Our mission is to be the first choice for Arabic-speaking digital learning — without compromising international quality standards.'}
                </p>
            </section>

            <section className="mt-14 space-y-6">
                <h2 className={`text-2xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'قيمنا' : 'Our Values'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {VALUES.map((v, i) => (
                        <div key={i} className={`p-7 rounded-3xl border shadow-sm hover:shadow-xl transition-all duration-300 ${dark ? 'bg-brand-navy-dark border-white/10 hover:border-brand-gold/40' : 'bg-white border-gray-200 hover:border-brand-gold/40'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${dark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/10 text-brand-gold-dark'}`}>
                                <v.icon size={24} />
                            </div>
                            <h3 className={`text-lg font-bold mb-2 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? v.titleAr : v.titleEn}</h3>
                            <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{isAr ? v.descAr : v.descEn}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-14 rounded-3xl bg-brand-navy p-10 text-center">
                <h2 className="text-2xl font-black text-white mb-4">{isAr ? 'جاهز للبدء؟' : 'Ready to Start?'}</h2>
                <p className="text-brand-mist mb-8">
                    {isAr ? 'انضم إلى آلاف المتعلمين وابدأ رحلتك اليوم.' : 'Join thousands of learners and start your journey today.'}
                </p>
                <Link
                    href="/courses"
                    className="inline-block bg-brand-gold hover:bg-[#b08e50] text-brand-navy px-8 py-4 rounded-xl font-black transition"
                >
                    {isAr ? 'استكشف الدورات' : 'Explore Courses'}
                </Link>
            </section>
        </MarketingShell>
    );
}