"use client";

import { useCallback, useEffect, useState } from 'react';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { Loader, Plus, Pencil, Trash2, Eye, EyeOff, X, Image, Video, FileText, ArrowUpDown } from 'lucide-react';
import { PageHeader, Badge, BtnSoft } from '../components';

interface Announcement {
    id: string;
    titleAr: string;
    titleEn: string;
    bodyAr?: string | null;
    bodyEn?: string | null;
    mediaType: string;
    mediaUrl?: string | null;
    linkUrl?: string | null;
    priority: number;
    isActive: boolean;
    durationSeconds: number;
    startsAt?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    author?: { id: string; email: string };
}

const emptyForm = {
    titleAr: '',
    titleEn: '',
    bodyAr: '',
    bodyEn: '',
    mediaType: 'none',
    mediaUrl: '',
    linkUrl: '',
    priority: 0,
    isActive: true,
    durationSeconds: 5,
    startsAt: '',
    expiresAt: '',
};

export default function AdminAnnouncementsPage() {
    const { t } = useI18n();
    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [useVideoDuration, setUseVideoDuration] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/api/admin/announcement-board');
            setItems(res.data);
        } catch {
            /* silent */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEdit = (item: Announcement) => {
        setEditing(item);
        setForm({
            titleAr: item.titleAr,
            titleEn: item.titleEn,
            bodyAr: item.bodyAr ?? '',
            bodyEn: item.bodyEn ?? '',
            mediaType: item.mediaType,
            mediaUrl: item.mediaUrl ?? '',
            linkUrl: item.linkUrl ?? '',
            priority: item.priority,
            isActive: item.isActive,
            durationSeconds: item.durationSeconds || 5,
            startsAt: item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : '',
            expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : '',
        });
        setShowForm(true);
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/chat/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const url = res.data.url;

            if (form.mediaType === 'video' && useVideoDuration) {
                const vid = document.createElement('video');
                vid.preload = 'metadata';
                vid.src = API_BASE_URL + url;
                vid.onloadedmetadata = () => {
                    const dur = Math.ceil(vid.duration);
                    setForm(f => ({ ...f, mediaUrl: url, durationSeconds: dur > 0 ? dur : 5 }));
                };
                vid.onerror = () => {
                    setForm(f => ({ ...f, mediaUrl: url }));
                };
            } else {
                setForm(f => ({ ...f, mediaUrl: url }));
            }
        } catch (e) {
            toast.error(getErrorMessage(e) || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!form.titleAr.trim() || !form.titleEn.trim()) {
            toast.error(t('adminAnnouncements.title_required'));
            return;
        }
        setSaving(true);
        try {
            const payload: {
            titleAr: string;
            titleEn: string;
            bodyAr: string | null;
            bodyEn: string | null;
            mediaType: string;
            mediaUrl: string | null;
            linkUrl: string | null;
            priority: number;
            isActive: boolean;
            durationSeconds: number;
            startsAt: string | null;
            expiresAt: string | null;
        } = {
                titleAr: form.titleAr,
                titleEn: form.titleEn,
                bodyAr: form.bodyAr || null,
                bodyEn: form.bodyEn || null,
                mediaType: form.mediaType,
                mediaUrl: form.mediaUrl || null,
                linkUrl: form.linkUrl || null,
                priority: Number(form.priority) || 0,
                isActive: form.isActive,
                durationSeconds: Number(form.durationSeconds) || 5,
                startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
                expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
            };

            if (editing) {
                await api.patch(`/api/admin/announcement-board/${editing.id}`, payload);
                toast.success(t('adminAnnouncements.updated'));
            } else {
                await api.post('/api/admin/announcement-board', payload);
                toast.success(t('adminAnnouncements.created'));
            }
            setShowForm(false);
            load();
        } catch (e) {
            toast.error(getErrorMessage(e) || t('adminAnnouncements.save_failed'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('adminAnnouncements.delete_confirm'))) return;
        try {
            await api.delete(`/api/admin/announcement-board/${id}`);
            toast.success(t('adminAnnouncements.deleted'));
            load();
        } catch (e) {
            toast.error(getErrorMessage(e) || 'Failed');
        }
    };

    const toggleActive = async (item: Announcement) => {
        try {
            await api.patch(`/api/admin/announcement-board/${item.id}`, { isActive: !item.isActive });
            load();
        } catch (e) {
            toast.error(getErrorMessage(e) || 'Failed');
        }
    };

    const mediaTypeIcon = (mt: string) => {
        switch (mt) {
            case 'image': return <Image size={14} className="text-brand-gold-dark dark:text-brand-gold-light" />;
            case 'video': return <Video size={14} className="text-brand-gold-dark dark:text-brand-gold-light" />;
            default: return <FileText size={14} className="text-brand-gold-dark dark:text-brand-gold-light" />;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('adminAnnouncements.heading')}
                subtitle={t('adminAnnouncements.subtitle')}
                actions={
                    <button onClick={openCreate} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-4 py-2.5 rounded-xl font-bold hover:from-brand-gold-light hover:to-brand-gold transition cursor-pointer">
                        <Plus size={18} /> {t('adminAnnouncements.new')}
                    </button>
                }
            />

            {loading ? (
                <div className="h-64 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-12 text-center">
                    <FileText size={32} className="mx-auto text-gray-500 dark:text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">{t('adminAnnouncements.empty')}</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-white/5">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminAnnouncements.col_title')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminAnnouncements.col_type')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminAnnouncements.col_priority')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminAnnouncements.col_status')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('adminAnnouncements.col_dates')}</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{''}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                {items.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-100 dark:hover:bg-white/5 transition">
                                        <td className="p-4">
                                            <div className="font-bold text-sm text-brand-navy dark:text-white truncate max-w-[280px]">{item.titleEn}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">{item.titleAr}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5">
                                                {mediaTypeIcon(item.mediaType)}
                                                <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">{item.mediaType}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1">
                                                <ArrowUpDown size={12} className="text-gray-500 dark:text-gray-400" />
                                                <span className="text-sm text-gray-600 dark:text-gray-300 font-bold">{item.priority}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge tone={item.isActive ? 'green' : 'gray'}>{item.isActive ? t('adminAnnouncements.active') : t('adminAnnouncements.inactive')}</Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {item.startsAt && <div>{t('adminAnnouncements.from')} {new Date(item.startsAt).toLocaleDateString()}</div>}
                                                {item.expiresAt && <div>{t('adminAnnouncements.until')} {new Date(item.expiresAt).toLocaleDateString()}</div>}
                                                {!item.startsAt && !item.expiresAt && <span>{t('adminAnnouncements.always')}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 justify-end">
                                                <BtnSoft icon={item.isActive ? EyeOff : Eye} onClick={() => toggleActive(item)}>
                                                    {item.isActive ? t('adminAnnouncements.hide') : t('adminAnnouncements.show')}
                                                </BtnSoft>
                                                <BtnSoft icon={Pencil} onClick={() => openEdit(item)}>{t('adminAnnouncements.edit')}</BtnSoft>
                                                <BtnSoft icon={Trash2} onClick={() => handleDelete(item.id)}>{t('adminAnnouncements.delete')}</BtnSoft>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                    <div className="bg-brand-navy-dark rounded-3xl shadow-2xl p-6 lg:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-in-up border border-white/10 admin-scroll" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white">{editing ? t('adminAnnouncements.edit') : t('adminAnnouncements.new')}</h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.title_en')} *</label>
                                    <input value={form.titleEn} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.title_ar')} *</label>
                                    <input value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} dir="rtl" className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.body_en')}</label>
                                    <textarea value={form.bodyEn} onChange={e => setForm(f => ({ ...f, bodyEn: e.target.value }))} rows={3} className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.body_ar')}</label>
                                    <textarea value={form.bodyAr} onChange={e => setForm(f => ({ ...f, bodyAr: e.target.value }))} rows={3} dir="rtl" className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white resize-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.media_type')}</label>
                                    <select value={form.mediaType} onChange={e => setForm(f => ({ ...f, mediaType: e.target.value }))} className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white">
                                        <option value="none">{t('adminAnnouncements.type_none')}</option>
                                        <option value="image">{t('adminAnnouncements.type_image')}</option>
                                        <option value="video">{t('adminAnnouncements.type_video')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.duration_seconds')}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={300}
                                        value={form.durationSeconds}
                                        onChange={e => setForm(f => ({ ...f, durationSeconds: Number(e.target.value) || 5 }))}
                                        disabled={form.mediaType === 'video' && useVideoDuration}
                                        className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    {form.mediaType === 'video' && (
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={useVideoDuration}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setUseVideoDuration(checked);
                                                    if (checked && form.mediaUrl) {
                                                        const vid = document.createElement('video');
                                                        vid.preload = 'metadata';
                                                        vid.src = API_BASE_URL + form.mediaUrl;
                                                        vid.onloadedmetadata = () => {
                                                            const dur = Math.ceil(vid.duration);
                                                            if (dur > 0) setForm(f => ({ ...f, durationSeconds: dur }));
                                                        };
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-white/20 bg-brand-navy-dark text-brand-gold focus:ring-brand-gold"
                                            />
                                            <span className="text-xs text-gray-400 font-semibold">{t('adminAnnouncements.use_video_duration')}</span>
                                        </label>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.priority')}</label>
                                    <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white" />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-3 cursor-pointer pb-3">
                                        <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-5 h-5 rounded border-white/20 bg-brand-navy-dark text-brand-gold focus:ring-brand-gold" />
                                        <span className="text-sm font-bold text-white">{t('adminAnnouncements.active')}</span>
                                    </label>
                                </div>
                            </div>

                            {form.mediaType !== 'none' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.media_file')}</label>
                                    <div className="flex items-center gap-3">
                                        <input type="file" accept={form.mediaType === 'video' ? 'video/*' : 'image/*'} className="hidden" id="media-upload" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                                        <label htmlFor="media-upload" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition">
                                            {uploading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                                            {form.mediaUrl ? t('adminAnnouncements.change_file') : t('adminAnnouncements.choose_file')}
                                        </label>
                                        {form.mediaUrl && (
                                            <span className="text-xs text-gray-400 truncate max-w-[200px]">{form.mediaUrl.split('/').pop()}</span>
                                        )}
                                    </div>
                                    {form.mediaUrl && form.mediaType === 'image' && (
                                        <img src={`${API_BASE_URL}${form.mediaUrl}`} alt="preview" className="mt-3 h-32 rounded-xl object-cover border border-white/10" />
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.link_url')}</label>
                                <input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="https://..." className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.starts_at')}</label>
                                    <input type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('adminAnnouncements.expires_at')}</label>
                                    <input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="w-full px-4 py-3 bg-brand-navy-dark border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-white" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-gray-400 hover:text-white font-bold text-sm transition">{t('common.cancel')}</button>
                                <button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-6 py-2.5 rounded-xl font-bold hover:from-brand-gold-light hover:to-brand-gold disabled:opacity-40 transition cursor-pointer flex items-center gap-2">
                                    {saving && <Loader size={14} className="animate-spin" />}
                                    {t('adminAnnouncements.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
