"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Pencil, Trash2, ExternalLink, CreditCard, Wallet, Upload, PlayCircle, X } from 'lucide-react';
import { PageHeader, Badge, EmptyPanel, BtnSoft, type Tone } from '../components';
import { mediaUrl, type PaymentGateway } from '@/components/payment/PaymentMethods';

type Gateway = PaymentGateway & { isActive: boolean; createdAt: string };

interface GatewayForm {
    name: string;
    instructions: string;
    guideImages: string[];
    guideVideoUrl: string;
    isActive: boolean;
}

const EMPTY_FORM: GatewayForm = { name: '', instructions: '', guideImages: [], guideVideoUrl: '', isActive: true };
const MAX_IMAGES = 8;

export default function AdminGatewaysPage() {
    const { data: gateways, loading, error, refetch } = useFetchData<Gateway[]>('/api/admin/payment-gateways/all');
    const { t } = useI18n();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<GatewayForm>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEdit = (g: Gateway) => {
        setEditingId(g.id);
        setForm({
            name: g.name,
            instructions: g.instructions,
            guideImages: Array.isArray(g.guideImages) ? g.guideImages.filter(Boolean) : [],
            guideVideoUrl: g.guideVideoUrl || '',
            isActive: g.isActive,
        });
        setShowForm(true);
    };

    const uploadMedia = async (file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/api/admin/payment-gateways/media', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.url as string;
    };

    const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploading('image');
        try {
            const uploaded: string[] = [];
            for (const file of files) {
                const url = await uploadMedia(file);
                if (!form.guideImages.includes(url)) uploaded.push(url);
            }
            // Cap client-side too, so the admin never gets a server-side 400 for
            // the 9th image.
            setForm(prev => ({ ...prev, guideImages: [...prev.guideImages, ...uploaded].slice(0, MAX_IMAGES) }));
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.gateway_upload_failed'));
        } finally {
            setUploading(null);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading('video');
        try {
            const url = await uploadMedia(file);
            setForm(prev => ({ ...prev, guideVideoUrl: url }));
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.gateway_upload_failed'));
        } finally {
            setUploading(null);
            if (videoInputRef.current) videoInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.instructions.trim()) {
            toast.error(t('admin.gateway_validation'));
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                instructions: form.instructions,
                guideImages: form.guideImages,
                guideVideoUrl: form.guideVideoUrl || null,
                isActive: form.isActive,
            };
            if (editingId) {
                await api.patch(`/api/admin/payment-gateways/${editingId}`, payload);
                toast.success(t('admin.gateway_updated'));
            } else {
                await api.post('/api/admin/payment-gateways', payload);
                toast.success(t('admin.gateway_created'));
            }
            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || (editingId ? t('admin.gateway_update_fail') : t('admin.gateway_create_fail')));
        }
        setSaving(false);
    };

    const handleDelete = async (g: Gateway) => {
        if (!window.confirm(t('admin.delete_gateway_confirm'))) return;
        setProcessingId(g.id);
        try {
            await api.delete(`/api/admin/payment-gateways/${g.id}`);
            toast.success(t('admin.gateway_deleted'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.gateway_delete_fail'));
        }
        setProcessingId(null);
    };

    const handleToggleActive = async (g: Gateway) => {
        setProcessingId(g.id);
        try {
            await api.patch(`/api/admin/payment-gateways/${g.id}`, { isActive: !g.isActive });
            toast.success(t('admin.gateway_updated'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.gateway_update_fail'));
        }
        setProcessingId(null);
    };

    const activeCount = (gateways || []).filter(g => g.isActive).length;
    const isActiveTone = (b: boolean): Tone => (b ? 'green' : 'gray');

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.gateways_heading')}
                subtitle={t('admin.gateways_subtitle')}
                actions={
                    <button onClick={openCreate} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-4 py-2.5 rounded-xl font-bold hover:from-brand-gold-dark hover:to-brand-gold-dark transition-all duration-200 shadow-md shadow-brand-gold/15 hover:-translate-y-0.5 cursor-pointer">
                        <PlusCircle size={18} /> {t('admin.add_gateway')}
                    </button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl animate-fade-in-up">
                {[
                    { value: (gateways || []).length, label: t('admin.stat_gateways'), color: 'text-brand-navy dark:text-white' },
                    { value: activeCount, label: t('admin.active_tag'), color: 'text-emerald-600 dark:text-emerald-400' },
                    { value: (gateways || []).length - activeCount, label: t('admin.inactive_tag'), color: 'text-gray-500 dark:text-gray-400' },
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-4">
                        <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('admin.loading_gateways')}</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 animate-fade-in-up">
                    {gateways?.map(g => (
                        <div key={g.id} className={`bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex flex-col ${!g.isActive ? 'opacity-70' : ''}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${g.isActive ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}>
                                        <CreditCard size={20} />
                                    </div>
                                    <h4 className="font-black text-brand-navy dark:text-white">{g.name}</h4>
                                </div>
                                <Badge tone={isActiveTone(g.isActive)} dot>
                                    {g.isActive ? t('admin.active_tag') : t('admin.inactive_tag')}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-4 flex-1 leading-relaxed">{g.instructions}</p>
                            {(() => {
                                const images = (Array.isArray(g.guideImages) ? g.guideImages : []).filter(Boolean);
                                const video = mediaUrl(g.guideVideoUrl);
                                if (images.length === 0 && !video) return null;
                                return (
                                    <div className="mb-4 space-y-2">
                                        {images.length > 0 && (
                                            <div className="flex gap-2 flex-wrap">
                                                {images.map((img) => (
                                                    <a
                                                        key={img}
                                                        href={mediaUrl(img) || '#'}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 hover:border-brand-gold transition"
                                                    >
                                                        <img src={mediaUrl(img) || ''} alt={t('payment.guide_media')} className="w-full h-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                        {video && (
                                            <a href={video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-gold-dark dark:text-brand-gold-light font-bold text-sm hover:underline w-fit">
                                                <PlayCircle size={16} /> {t('admin.view_video')} <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                );
                            })()}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/5">
                                <button onClick={() => handleToggleActive(g)} disabled={processingId === g.id} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-40 cursor-pointer ${g.isActive ? 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 ring-1 ring-emerald-200 dark:ring-emerald-500/30'}`}>
                                    {g.isActive ? t('admin.deactivate') : t('admin.activate')}
                                </button>
                                <div className="flex gap-1.5">
                                    <button onClick={() => openEdit(g)} disabled={processingId === g.id} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 transition cursor-pointer tooltip" title={t('admin.edit_gateway')}>
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(g)} disabled={processingId === g.id} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-40 transition cursor-pointer tooltip" title={t('admin.delete_user_title')}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {gateways?.length === 0 && (
                        <div className="col-span-full bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl p-4">
                            <EmptyPanel icon={Wallet} title={t('admin.no_gateways')} color="teal" />
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => { setShowForm(false); setEditingId(null); }}>
                    <div className="bg-brand-navy border border-white/10 rounded-3xl shadow-2xl max-w-lg w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-5">{editingId ? t('admin.edit_gateway') : t('admin.new_gateway')}</h4>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder={t('admin.gateway_name_placeholder')}
                                className="w-full p-3 border border-white/10 bg-brand-navy-dark rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-white placeholder:text-gray-500"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                            />
                            <textarea
                                placeholder={t('admin.gateway_instructions_placeholder')}
                                className="w-full p-3 border border-white/10 bg-brand-navy-dark rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-white placeholder:text-gray-500"
                                rows={4}
                                value={form.instructions}
                                onChange={e => setForm({ ...form, instructions: e.target.value })}
                            />
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-300">{t('admin.gateway_guide_images')}</span>
                                    <button
                                        type="button"
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={uploading !== null || form.guideImages.length >= MAX_IMAGES}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gold-light hover:underline disabled:opacity-40 transition cursor-pointer"
                                    >
                                        <Upload size={14} /> {form.guideImages.length >= MAX_IMAGES ? `${form.guideImages.length}/${MAX_IMAGES}` : t('admin.gateway_add_image')}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">{t('admin.gateway_guide_images_hint')}</p>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    ref={imageInputRef}
                                    onChange={handleImageFiles}
                                />
                                {uploading === 'image' && <p className="text-xs text-brand-gold-light">{t('admin.gateway_uploading')}</p>}
                                {form.guideImages.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {form.guideImages.map((img) => (
                                            <div key={img} className="relative group">
                                                <img src={mediaUrl(img) || ''} alt={t('payment.guide_media')} className="w-full h-16 object-cover rounded-lg border border-white/10" />
                                                <button
                                                    type="button"
                                                    onClick={() => setForm(prev => ({ ...prev, guideImages: prev.guideImages.filter(u => u !== img) }))}
                                                    className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition cursor-pointer"
                                                    aria-label={t('admin.gateway_remove')}
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-300">{t('admin.gateway_guide_video')}</span>
                                    <button
                                        type="button"
                                        onClick={() => videoInputRef.current?.click()}
                                        disabled={uploading !== null}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gold-light hover:underline disabled:opacity-40 transition cursor-pointer"
                                    >
                                        <Upload size={14} /> {t('admin.gateway_replace_video')}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">{t('admin.gateway_guide_video_hint')}</p>
                                <input
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime"
                                    className="hidden"
                                    ref={videoInputRef}
                                    onChange={handleVideoFile}
                                />
                                {uploading === 'video' && <p className="text-xs text-brand-gold-light">{t('admin.gateway_uploading')}</p>}
                                {form.guideVideoUrl && (
                                    <div className="flex items-center gap-2">
                                        <video src={mediaUrl(form.guideVideoUrl) || ''} controls preload="metadata" className="w-full max-h-40 rounded-lg bg-black" />
                                        <button
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, guideVideoUrl: '' }))}
                                            className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center hover:bg-red-500/25 transition cursor-pointer"
                                            aria-label={t('admin.gateway_remove')}
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <label className="flex items-center gap-2 font-bold cursor-pointer text-sm text-gray-300">
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-brand-gold" />
                                {t('admin.active_gateway')}
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <BtnSoft onClick={() => { setShowForm(false); setEditingId(null); }} disabled={saving || uploading !== null}>{t('common.cancel')}</BtnSoft>
                            <button onClick={handleSave} disabled={saving || uploading !== null} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-5 py-2.5 rounded-xl font-bold hover:from-brand-gold-dark hover:to-brand-gold-dark transition disabled:opacity-50 cursor-pointer">
                                {saving ? t('common.saving') : t('admin.save_gateway')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
