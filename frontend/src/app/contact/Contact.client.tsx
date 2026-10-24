"use client";

import { useState } from 'react';
import { Mail, Clock, MessageSquare, CheckCircle2, Play, Camera, Send, Hash, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import MarketingShell from '@/components/MarketingShell';
import { api, getErrorMessage } from '@/lib/api';

export default function ContactContent() {
    const { t, locale } = useI18n();
    const { dark } = useTheme();
    const isAr = locale === 'ar';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);
        try {
            await api.post('/public/contact', { name, email, subject, message });
            setSuccess(true);
            setName('');
            setEmail('');
            setSubject('');
            setMessage('');
        } catch (err) {
            setError(getErrorMessage(err) || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const inputCls = dark
        ? 'block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-white placeholder-gray-500 [color-scheme:dark]'
        : 'block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-brand-charcoal placeholder-gray-400';

    return (
        <MarketingShell
            title={isAr ? 'تواصل معنا' : 'Contact Us'}
            subtitle={
                isAr
                    ? 'نسعد بسماعك. أرسل رسالتك وسيقوم فريقنا بالرد خلال 24–48 ساعة عمل.'
                    : 'We’d love to hear from you. Send a message and our team will reply within 24–48 business hours.'}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={`md:col-span-2 rounded-3xl border shadow-sm p-8 ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                    <h2 className={`text-xl font-black mb-6 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'أرسل رسالة' : 'Send a Message'}</h2>

                    {success && (
                        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold flex items-start gap-2 ${dark ? 'bg-green-500/10 border border-green-400/30 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                            {isAr
                                ? 'تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.'
                                : 'Your message has been sent successfully. We will get back to you soon.'}
                        </div>
                    )}

                    {error && (
                        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold ${dark ? 'bg-red-500/10 border border-red-400/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-bold mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{isAr ? 'الاسم' : 'Name'}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputCls}
                                    maxLength={200}
                                    required
                                    placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-bold mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputCls}
                                    required
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-bold mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{isAr ? 'الموضوع' : 'Subject'}</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className={inputCls}
                                maxLength={200}
                                placeholder={isAr ? 'موضوع الرسالة' : 'Message subject'}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-bold mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{isAr ? 'الرسالة' : 'Message'}</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className={`${inputCls} min-h-36 resize-y`}
                                maxLength={4000}
                                required
                                placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto py-4 px-10 bg-brand-gold hover:bg-[#b08e50] text-brand-navy font-black rounded-xl shadow-md transition disabled:opacity-60"
                        >
                            {loading ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : isAr ? 'إرسال الرسالة' : 'Send Message'}
                        </button>
                    </form>
                </div>

                <aside className="space-y-5">
                    <div className={`rounded-3xl border shadow-sm p-7 ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/10 text-brand-gold-dark'}`}>
                            <Mail size={22} />
                        </div>
                        <h3 className={`font-bold mb-1 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'دعم المنصة' : 'Platform Support'}</h3>
                        <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr">support@laxalab.com</p>
                    </div>
                    <div className={`rounded-3xl border shadow-sm p-7 ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/10 text-brand-gold-dark'}`}>
                            <Clock size={22} />
                        </div>
                        <h3 className={`font-bold mb-1 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'ساعات العمل' : 'Working Hours'}</h3>
                        <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {isAr
                                ? 'طوال أيام الأسبوع، 24 ساعة (بتوقيت مكة المكرمة).'
                                : 'Open 24 hours a day, 7 days a week (Makkah time).'}
                        </p>
                    </div>
                    <div className={`rounded-3xl border shadow-sm p-7 ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/10 text-brand-gold-dark'}`}>
                            <MessageSquare size={22} />
                        </div>
                        <h3 className={`font-bold mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'التذاكر' : 'Tickets'}</h3>
                        <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {isAr
                                ? 'المستخدمون المسجلون يمكنهم فتح تذكرة دعم من لوحة التحكم مباشرة.'
                                : 'Registered users can open a support ticket directly from their dashboard.'}
                        </p>
                    </div>
                    <div className={`rounded-3xl border shadow-sm p-7 ${dark ? 'bg-brand-navy-dark border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/10 text-brand-gold-dark'}`}>
                            <Send size={22} />
                        </div>
                        <h3 className={`font-bold mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>{isAr ? 'تابعنا على منصات التواصل' : 'Follow us'}</h3>
                        <ul className="space-y-2.5">
                            {[
                                { icon: Play, label: 'YouTube', handle: '@laxalabacademy', href: 'https://www.youtube.com/@laxalabacademy' },
                                { icon: Camera, label: 'Instagram', handle: '@laxalabacademy', href: 'https://www.instagram.com/laxalabacademy' },
                                { icon: Send, label: 'Telegram', handle: '@laxalabacademy', href: 'https://t.me/laxalabacademy' },
                                { icon: Hash, label: 'X (Twitter)', handle: '@laxalabacademy', href: 'https://x.com/laxalabacademy' },
                                { icon: Globe, label: 'Facebook', handle: 'laxalabacademy', href: 'https://facebook.com/laxalabacademy' },
                            ].map((s) => (
                                <li key={s.label}>
                                    <a
                                        href={s.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${dark
                                            ? 'bg-white/5 hover:bg-brand-gold hover:text-brand-navy text-gray-200'
                                            : 'bg-gray-100 hover:bg-brand-gold hover:text-brand-navy text-gray-700'}`}
                                    >
                                        <s.icon size={18} className="shrink-0" />
                                        <span className="flex-1">{s.label}</span>
                                        <span className={`text-xs font-normal ${dark ? 'text-gray-500' : 'text-gray-500'}`} dir="ltr">{s.handle}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>
        </MarketingShell>
    );
}