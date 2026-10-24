"use client";

import { useMemo, useState } from 'react';
import { useFetchData } from '@/lib/useFetchData';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { MessageCircle, Archive, ArchiveRestore, Eye, X, Loader, Inbox, FileText } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnSoft } from '../components';

interface ChatUser { id: string; email: string; }
interface LastMessage { content: string; attachmentType?: string | null; createdAt: string; fromMe: boolean; }
interface DirectChatRow {
    id: string;
    archived: boolean;
    archivedAt?: string | null;
    course: { id: string; title: string };
    student: ChatUser;
    instructor: ChatUser;
    lastMessage?: LastMessage | null;
    unreadCount: number;
}

interface ThreadMsg {
    id: string;
    content: string;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    createdAt: string;
    senderId: string;
    sender?: { id: string; email: string; role: string } | null;
}

type Filter = 'all' | 'active' | 'archived';

export default function AdminChatsPage() {
    const { t } = useI18n();
    const [filter, setFilter] = useState<Filter>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedChat, setSelectedChat] = useState<DirectChatRow | null>(null);
    const [thread, setThread] = useState<ThreadMsg[] | null>(null);
    const [threadLoading, setThreadLoading] = useState(false);

    const { data: chats, loading, refetch } = useFetchData<DirectChatRow[]>('/chat/direct');

    const filtered = useMemo(() => {
        if (!chats) return [];
        if (filter === 'active') return chats.filter(c => !c.archived);
        if (filter === 'archived') return chats.filter(c => c.archived);
        return chats;
    }, [chats, filter]);

    const openThread = async (chat: DirectChatRow) => {
        setSelectedChat(chat);
        setThreadLoading(true);
        setThread(null);
        try {
            const res = await api.get(`/chat/direct/${chat.id}/thread`);
            setThread((res.data.messages || []).slice().reverse());
        } catch (e) {
            toast.error(getErrorMessage(e) || t('adminChats.action_fail'));
        } finally {
            setThreadLoading(false);
        }
    };

    const toggleArchive = async (chat: DirectChatRow) => {
        const next = !chat.archived;
        if (!window.confirm(t(next ? 'adminChats.archive_confirm' : 'adminChats.unarchive_confirm'))) return;
        setProcessingId(chat.id);
        try {
            await api.patch(`/chat/direct/${chat.id}/archive`, { archived: next });
            toast.success(t(next ? 'adminChats.archive_done' : 'adminChats.unarchive_done'));
            refetch();
            if (selectedChat?.id === chat.id) {
                setSelectedChat({ ...selectedChat, archived: next, archivedAt: next ? new Date().toISOString() : null });
            }
        } catch (e) {
            toast.error(getErrorMessage(e) || t('adminChats.action_fail'));
        } finally {
            setProcessingId(null);
        }
    };

    const fileFilters: Filter[] = ['all', 'active', 'archived'];

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('adminChats.heading')}
                subtitle={t('adminChats.subtitle')}
            />

            <div className="flex flex-wrap gap-2">
                {fileFilters.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                            filter === f ? 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                    >
                        {t(`adminChats.filter_${f}`)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : (
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-white/5">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminChats.student')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminChats.instructor')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminChats.course')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminChats.last_message')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{''}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{''}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                {filtered.length === 0 ? (
                                    <EmptyState icon={MessageCircle} title={t('adminChats.empty')} />
                                ) : filtered.map(chat => (
                                    <tr key={chat.id} className="hover:bg-gray-100 dark:hover:bg-white/5 transition">
                                        <td className="p-4">
                                            <div className="font-bold text-sm text-brand-navy dark:text-white">{chat.student.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-sm text-brand-navy dark:text-white">{chat.instructor.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-gray-600 dark:text-gray-300 max-w-[220px] truncate">{chat.course.title}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[220px] truncate">
                                                {chat.lastMessage
                                                    ? (chat.lastMessage.content || (chat.lastMessage.attachmentType ? '📎' : ''))
                                                    : '—'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {chat.archived ? (
                                                    <Badge tone={filter === 'archived' ? 'gray' : 'amber'}>{t('adminChats.archived_badge')}</Badge>
                                                ) : chat.unreadCount > 0 ? (
                                                    <Badge tone="gold">{chat.unreadCount} {t('adminChats.unread_badge')}</Badge>
                                                ) : (
                                                    <Badge tone="green" dot={false}>{t('adminChats.filter_active')}</Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 justify-end">
                                                <BtnSoft icon={Eye} onClick={() => openThread(chat)}>{t('adminChats.view')}</BtnSoft>
                                                <BtnSoft
                                                    icon={chat.archived ? ArchiveRestore : Archive}
                                                    onClick={() => toggleArchive(chat)}
                                                    disabled={processingId === chat.id}
                                                >
                                                    {chat.archived ? t('adminChats.unarchive') : t('adminChats.archive')}
                                                </BtnSoft>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedChat && (
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-200 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold-light rounded-xl flex items-center justify-center">
                                <MessageCircle size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-brand-navy dark:text-white">{t('adminChats.thread_title')}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                                    {selectedChat.student.email} ↔ {selectedChat.instructor.email}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedChat(null)} className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-5 h-[420px] overflow-y-auto flex flex-col gap-3 bg-brand-navy">
                        {threadLoading ? (
                            <div className="m-auto text-brand-gold">
                                <Loader className="animate-spin" size={28} />
                            </div>
                        ) : thread && thread.length === 0 ? (
                            <div className="m-auto text-center text-gray-400">
                                <Inbox size={36} className="mx-auto mb-2 text-brand-gold/60" />
                                <p className="font-bold">{t('adminChats.no_messages')}</p>
                            </div>
                        ) : thread ? (
                            thread.map(m => (
                                <div key={m.id} className={`flex ${m.senderId === selectedChat.student.id ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                                        m.senderId === selectedChat.student.id
                                            ? 'bg-white/5 border border-white/10 text-gray-300 rounded-bl-md'
                                            : 'bg-brand-gold/20 text-white rounded-br-md'
                                    }`}>
                                        <div className="text-[10px] font-bold mb-0.5 text-brand-gold-light">
                                            {m.sender?.email ?? ''}
                                        </div>
                                        {m.content && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>}
                                        {m.attachmentUrl && (
                                            <a href={`${API_BASE_URL}${m.attachmentUrl}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 underline text-xs text-brand-gold-light">
                                                <FileText size={12} /> {m.attachmentUrl.split('/').pop()}
                                            </a>
                                        )}
                                        <div className="text-[9px] mt-1 text-gray-500">
                                            {new Date(m.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : null}
                    </div>
                    <div className="flex justify-end px-5 py-3 border-t border-gray-200 dark:border-white/5">
                        <BtnSoft
                            icon={selectedChat.archived ? ArchiveRestore : Archive}
                            onClick={() => toggleArchive(selectedChat)}
                            disabled={processingId === selectedChat.id}
                        >
                            {selectedChat.archived ? t('adminChats.unarchive') : t('adminChats.archive')}
                        </BtnSoft>
                    </div>
                </div>
            )}
        </div>
    );
}
