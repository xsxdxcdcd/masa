"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { Loader, Send, MessageSquarePlus, X, Inbox as InboxIcon } from 'lucide-react';
import { PageHeader } from '@/app/dashboard/admin/components';

interface Conv {
    id: string;
    otherUser: { id: string; email: string; role: string };
    course: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
    lastMessage: { content: string; createdAt: string; fromMe: boolean; read: boolean };
    unreadCount: number;
    updatedAt: string;
}
interface ThreadMsg {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    readAt?: string | null;
}
interface Contact {
    id: string;
    email: string;
    role: string;
    course?: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
}
interface Contacts {
    admins: Contact[];
    instructors: Contact[];
    students: Contact[];
}

const roleLabel: Record<string, string> = {
    STUDENT: 'roles.student',
    INSTRUCTOR: 'roles.instructor',
    COURSE_MANAGER: 'roles.course_manager',
    FINANCE: 'roles.finance',
    ADMIN: 'roles.admin',
};

export default function InboxPage() {
    const { t, pick } = useI18n();
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conv[]>([]);
    const [loadingConv, setLoadingConv] = useState(true);
    const [active, setActive] = useState<Conv | null>(null);
    const [thread, setThread] = useState<ThreadMsg[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [newOpen, setNewOpen] = useState(false);
    const [contacts, setContacts] = useState<Contacts>({ admins: [], instructors: [], students: [] });
    const threadBoxRef = useRef<HTMLDivElement>(null);

    const loadConversations = useCallback(async () => {
        try {
            const res = await api.get('/messages/conversations');
            setConversations(res.data);
        } catch {
            /* keep silent on polling */
        } finally {
            setLoadingConv(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        const refresh = async () => {
            try {
                const res = await api.get('/messages/conversations');
                if (active) setConversations(res.data);
            } catch {
                /* keep silent on polling */
            } finally {
                if (active) setLoadingConv(false);
            }
        };
        refresh();
        const timer = setInterval(refresh, 10000);
        return () => { active = false; clearInterval(timer); };
    }, []);

    const openThread = useCallback(async (conv: Conv, markRead: boolean) => {
        setActive(conv);
        setLoadingThread(true);
        const params = new URLSearchParams({ with: conv.otherUser.id });
        if (conv.course) params.set('courseId', conv.course.id);
        try {
            const res = await api.get(`/messages/thread?${params.toString()}`);
            setThread(res.data);
            if (markRead && conv.unreadCount > 0) {
                await api.patch(`/messages/read?${params.toString()}`);
                loadConversations();
            }
        } catch (err) {
            toast.error(getErrorMessage(err) || t('inbox.message_fail'));
        }
        setLoadingThread(false);
    }, [loadConversations, t]);

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => { openThread(active, false); }, 10000);
        return () => clearInterval(timer);
    }, [active, openThread]);

    useEffect(() => {
        if (threadBoxRef.current) {
            threadBoxRef.current.scrollTop = threadBoxRef.current.scrollHeight;
        }
    }, [thread]);

    const send = async () => {
        if (!active) return;
        if (!text.trim()) { toast.error(t('inbox.message_required')); return; }
        setSending(true);
        try {
            await api.post('/messages', {
                recipientId: active.otherUser.id,
                ...(active.course ? { courseId: active.course.id } : {}),
                content: text.trim(),
            });
            setText('');
            await openThread(active, false);
            loadConversations();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('inbox.message_fail'));
        }
        setSending(false);
    };

    const openNew = async () => {
        setNewOpen(true);
        try {
            const res = await api.get('/messages/contacts');
            setContacts(res.data);
        } catch {
            toast.error(t('inbox.message_fail'));
        }
    };

    const startContact = (c: Contact) => {
        const conv: Conv = {
            id: `${c.id}|${c.course?.id ?? ''}`,
            otherUser: { id: c.id, email: c.email, role: c.role },
            course: c.course ? { id: c.course.id, titleAr: c.course.titleAr, titleEn: c.course.titleEn } : null,
            lastMessage: { content: '', createdAt: '', fromMe: false, read: true },
            unreadCount: 0,
            updatedAt: '',
        };
        setNewOpen(false);
        openThread(conv, false);
    };

    const isStudent = user?.role === 'STUDENT';
    const isInstructor = user?.role === 'INSTRUCTOR';
    const groupLabel = (): [string, Contact[]][] => {
        if (isStudent) return [[t('inbox.enrolled_courses'), contacts.instructors], [t('inbox.contact_support'), contacts.admins]];
        if (isInstructor) return [[t('inbox.my_students'), contacts.students], [t('inbox.contact_support'), contacts.admins]];
        return [[t('inbox.all_students'), contacts.students], [t('inbox.contact_support'), contacts.admins]];
    };

    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fmtDay = (iso: string) => new Date(iso).toLocaleDateString();

    return (
        <ProtectedRoute>
            <div className="space-y-6 animate-fade-in">
                <PageHeader
                    title={t('inbox.title')}
                    subtitle={t('inbox.subtitle')}
                    actions={
                        <button onClick={openNew} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-4 py-2.5 rounded-xl font-bold hover:from-brand-gold-light hover:to-brand-gold transition cursor-pointer">
                            <MessageSquarePlus size={18} /> {t('inbox.new_message')}
                        </button>
                    }
                />

                <div className="bg-white dark:bg-brand-navy-dark rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden flex flex-col md:flex-row min-h-[60vh]">
                    {/* Conversations list */}
                    <aside className={`md:w-80 border-b md:border-b-0 md:border-e border-gray-200 dark:border-white/5 ${active ? 'hidden md:block' : 'block'}`}>
                        <div className="p-4 border-b border-gray-200 dark:border-white/5">
                            <h3 className="font-black text-brand-navy dark:text-white">{t('inbox.conversations')}</h3>
                        </div>
                        <div className="overflow-y-auto h-[40vh] md:h-[calc(60vh-57px)] admin-scroll">
                            {loadingConv ? (
                                <div className="h-40 flex items-center justify-center"><Loader className="animate-spin text-brand-gold-dark dark:text-brand-gold-light" size={24} /></div>
                            ) : conversations.length === 0 ? (
                                <div className="p-8 text-center">
                                    <InboxIcon size={32} className="mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">{t('inbox.no_conversations')}</p>
                                </div>
                            ) : (
                                conversations.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => openThread(c, true)}
                                        className={`w-full text-left px-4 py-3.5 border-b border-gray-200 dark:border-white/5 hover:bg-brand-navy/5 dark:hover:bg-white/5 transition cursor-pointer ${active?.id === c.id ? 'bg-brand-navy/5 dark:bg-white/10' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-brand-navy dark:text-white text-sm truncate">{c.otherUser.email}</span>
                                            {c.unreadCount > 0 && (
                                                <span className="bg-brand-gold text-black text-[10px] font-black rounded-full min-w-5 h-5 px-1.5 inline-flex items-center justify-center">
                                                    {c.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        {c.course && (
                                            <span className="text-xs text-brand-gold-dark dark:text-brand-gold-light font-bold block mt-0.5 truncate">{t('inbox.course')} {pick(c.course, 'title')}</span>
                                        )}
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            <span className={`text-xs truncate ${c.unreadCount > 0 ? 'font-bold text-brand-navy dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {c.lastMessage.content}
                                            </span>
                                            {c.lastMessage.createdAt && <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{fmtDay(c.lastMessage.createdAt)}</span>}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>

                    {/* Thread */}
                    <section className={`flex-1 flex flex-col ${active ? 'flex' : 'hidden md:flex'}`}>
                        {!active ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                                <MessageSquarePlus size={40} className="text-gray-400 dark:text-gray-600 mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 font-bold">{t('inbox.select_conversation')}</p>
                            </div>
                        ) : (
                            <>
                                <div className="px-5 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-white/5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-black text-brand-navy dark:text-white truncate">{active.otherUser.email}</p>
                                        {active.course && (
                                            <p className="text-xs text-brand-gold-dark dark:text-brand-gold-light font-bold truncate">{t('inbox.course')} {pick(active.course, 'title')}</p>
                                        )}
                                    </div>
                                    <button onClick={() => setActive(null)} className="md:hidden text-gray-500 dark:text-gray-400 hover:text-brand-navy dark:hover:text-white"><X size={20} /></button>
                                </div>

                                <div ref={threadBoxRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/60 dark:bg-brand-navy-dark h-[40vh] md:h-[calc(60vh-130px)] admin-scroll">
                                    {loadingThread ? (
                                        <div className="flex justify-center pt-8"><Loader className="animate-spin text-brand-gold-dark dark:text-brand-gold-light" size={24} /></div>
                                    ) : thread.length === 0 ? (
                                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm pt-8">{t('inbox.select_conversation')}</p>
                                    ) : (
                                        thread.map((m) => {
                                            const mine = m.senderId === user?.userId;
                                            return (
                                                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                                        mine
                                                            ? 'bg-gradient-to-br from-brand-gold to-brand-gold-dark text-black rounded-br-md'
                                                            : 'bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 text-brand-navy dark:text-white rounded-bl-md'
                                                    }`}>
                                                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                                                        <span className={`block text-[10px] mt-1 ${mine ? 'text-black/50' : 'text-gray-400 dark:text-gray-500'}`}>
                                                            {fmtTime(m.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-4 border-t border-gray-200 dark:border-white/5 flex items-center gap-2">
                                    <input
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                                        placeholder={t('inbox.type_message')}
                                        className="flex-1 px-4 py-3 bg-white dark:bg-brand-navy-dark border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                    <button onClick={send} disabled={sending || !text.trim()} className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black p-3 rounded-xl hover:from-brand-gold-light hover:to-brand-gold disabled:opacity-40 transition cursor-pointer">
                                        {sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                </div>

                {/* New message modal */}
                {newOpen && (
                    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
                        <div className="bg-brand-navy-dark rounded-3xl shadow-2xl p-6 lg:p-8 w-full max-w-md animate-fade-in-up border border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-black text-white">{t('inbox.send_to')}</h3>
                                <button onClick={() => setNewOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                            </div>
                            <div className="space-y-5 max-h-[60vh] overflow-y-auto admin-scroll">
                                {groupLabel().map(([label, items]) => (
                                    <div key={label}>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
                                        {items.length === 0 ? (
                                            <p className="text-xs text-gray-500">{t('inbox.no_contacts')}</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {items.map((c) => (
                                                    <button
                                                        key={c.id + (c.course?.id ?? '')}
                                                        onClick={() => startContact(c)}
                                                        className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-brand-navy hover:bg-white/5 transition cursor-pointer"
                                                    >
                                                        <span className="block font-bold text-white text-sm">{c.email}</span>
                                                        <span className="block text-xs text-gray-400">
                                                            {t(roleLabel[c.role] ?? 'roles.unknown')}
                                                            {c.course && <> · {pick(c.course, 'title')}</>}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
