"use client";

import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n-context';
import { XCircle, Plus, Trash2, Film, Image as ImageIcon, Loader, FileText, Link2, Check } from 'lucide-react';
import { PageHeader } from '@/app/dashboard/admin/components';

interface ObjectiveDraft { objectiveAr: string; objectiveEn: string; }
interface PrereqDraft { prerequisiteAr: string; prerequisiteEn: string; }
interface AudienceDraft { audienceAr: string; audienceEn: string; }
interface FaqDraft { questionAr: string; questionEn: string; answerAr: string; answerEn: string; }
interface OutcomeDraft { descriptionAr: string; descriptionEn: string; }
interface ModuleDraft {
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    videoUrl: string;
    durationMinutes: string;
    outcomes: OutcomeDraft[];
    files: { url: string; nameAr: string; nameEn: string }[];
    links: { url: string; labelAr: string; labelEn: string }[];
}

interface ChapterDraft {
    titleAr: string;
    titleEn: string;
    modules: ModuleDraft[];
}

interface CourseInitial {
    titleAr?: string | null; titleEn?: string | null;
    excerptAr?: string | null; excerptEn?: string | null;
    descriptionAr?: string | null; descriptionEn?: string | null;
    categoryAr?: string | null; categoryEn?: string | null;
    level?: string | null; language?: string | null;
    contentType?: string | null;
    hoursOfContent?: number | null;
    syllabusAr?: string | null; syllabusEn?: string | null;
    durationAr?: string | null; durationEn?: string | null;
    coverImageUrl?: string | null; introVideoUrl?: string | null; videoFileUrl?: string | null;
    certificateIssued?: boolean | null;
    quizzesIncluded?: boolean | null; projectsIncluded?: boolean | null; assignmentsIncluded?: boolean | null;
    liveSessionsIncluded?: boolean | null; downloadableResources?: boolean | null;
    lifetimeAccess?: boolean | null; communityAccess?: boolean | null;
    objectives?: { objectiveAr: string; objectiveEn: string }[];
    prerequisites?: { prerequisiteAr: string; prerequisiteEn: string }[];
    audiences?: { audienceAr: string; audienceEn: string }[];
    faqs?: { questionAr: string; questionEn: string; answerAr: string; answerEn: string }[];
    gallery?: { url: string }[];
    modules?: { titleAr: string; titleEn: string; descriptionAr?: string | null; descriptionEn?: string | null; videoUrl?: string | null; durationMinutes?: number | null; outcomes?: { descriptionAr: string; descriptionEn: string }[]; files?: { url: string; nameAr?: string; nameEn?: string }[]; links?: { url: string; labelAr?: string; labelEn?: string }[] }[];
    chapters?: { titleAr: string; titleEn: string; modules?: { titleAr: string; titleEn: string; descriptionAr?: string | null; descriptionEn?: string | null; videoUrl?: string | null; durationMinutes?: number | null; outcomes?: { descriptionAr: string; descriptionEn: string }[]; files?: { url: string; nameAr?: string; nameEn?: string }[]; links?: { url: string; labelAr?: string; labelEn?: string }[] }[] }[];
}

interface FormValues {
    titleAr: string; titleEn: string;
    excerptAr: string; excerptEn: string;
    descriptionAr: string; descriptionEn: string;
    categoryAr: string; categoryEn: string;
    level: string; language: string;
    contentType: string;
    hoursOfContent: string;
    syllabusAr: string; syllabusEn: string;
    durationAr: string; durationEn: string;
    introVideoUrl: string;
    certificateIssued: boolean;
    quizzesIncluded: boolean; projectsIncluded: boolean; assignmentsIncluded: boolean;
    liveSessionsIncluded: boolean; downloadableResources: boolean; lifetimeAccess: boolean; communityAccess: boolean;
}

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'] as const;

const CONTENT_TYPES = ['LIVE', 'RECORDED'] as const;

const STEPS = [
    { key: 'basic', labelKey: 'createCourse.step_basic' },
    { key: 'media', labelKey: 'createCourse.step_media' },
    { key: 'learning', labelKey: 'createCourse.step_learning' },
    { key: 'structure', labelKey: 'createCourse.step_structure' },
    { key: 'features', labelKey: 'createCourse.step_features' },
    { key: 'review', labelKey: 'createCourse.step_review' },
] as const;

const strVal = (v?: string | null) => v || '';
const boolVal = (v?: boolean | null) => !!v;

function buildValues(src?: CourseInitial): FormValues {
    return {
        titleAr: strVal(src?.titleAr),
        titleEn: strVal(src?.titleEn),
        excerptAr: strVal(src?.excerptAr),
        excerptEn: strVal(src?.excerptEn),
        descriptionAr: strVal(src?.descriptionAr),
        descriptionEn: strVal(src?.descriptionEn),
        categoryAr: strVal(src?.categoryAr),
        categoryEn: strVal(src?.categoryEn),
        level: src?.level || 'BEGINNER',
        // Existing courses were all taught live, so an edit that predates the
        // type lands on LIVE rather than blank.
        contentType: src?.contentType || 'LIVE',
        language: strVal(src?.language),
        hoursOfContent: src?.hoursOfContent?.toString() ?? '',
        syllabusAr: strVal(src?.syllabusAr),
        syllabusEn: strVal(src?.syllabusEn),
        durationAr: strVal(src?.durationAr),
        durationEn: strVal(src?.durationEn),
        introVideoUrl: strVal(src?.introVideoUrl),
        certificateIssued: boolVal(src?.certificateIssued),
        quizzesIncluded: boolVal(src?.quizzesIncluded),
        projectsIncluded: boolVal(src?.projectsIncluded),
        assignmentsIncluded: boolVal(src?.assignmentsIncluded),
        liveSessionsIncluded: boolVal(src?.liveSessionsIncluded),
        downloadableResources: boolVal(src?.downloadableResources),
        lifetimeAccess: boolVal(src?.lifetimeAccess),
        communityAccess: boolVal(src?.communityAccess),
    };
}

function updateByIndex<T>(setter: (updater: (p: T[]) => T[]) => void, idx: number, patch: Partial<T>) {
    setter(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
}
function removeByIndex<T>(setter: (updater: (p: T[]) => T[]) => void, idx: number) {
    setter(prev => prev.filter((_, i) => i !== idx));
}

const newModuleDraft = (): ModuleDraft => ({
    titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', videoUrl: '',
    durationMinutes: '',
    outcomes: [], files: [], links: [],
});

const toModuleDraft = (m: { titleAr?: string | null; titleEn?: string | null; descriptionAr?: string | null; descriptionEn?: string | null; videoUrl?: string | null; durationMinutes?: number | null; outcomes?: { descriptionAr: string; descriptionEn: string }[]; files?: { url: string; nameAr?: string | null; nameEn?: string | null }[]; links?: { url: string; labelAr?: string | null; labelEn?: string | null }[] }): ModuleDraft => ({
    titleAr: strVal(m.titleAr),
    titleEn: strVal(m.titleEn),
    descriptionAr: strVal(m.descriptionAr),
    descriptionEn: strVal(m.descriptionEn),
    videoUrl: strVal(m.videoUrl),
    durationMinutes: m.durationMinutes != null ? String(m.durationMinutes) : '',
    outcomes: (m.outcomes || []).map(o => ({ descriptionAr: o.descriptionAr, descriptionEn: o.descriptionEn })),
    files: (m.files || []).map(f => ({ url: f.url, nameAr: strVal(f.nameAr), nameEn: strVal(f.nameEn) })),
    links: (m.links || []).map(l => ({ url: l.url, labelAr: strVal(l.labelAr), labelEn: strVal(l.labelEn) })),
});

function FeatureCheckbox({ reg, label }: { reg: UseFormRegisterReturn; label: string }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer bg-brand-mist/30 border border-brand-mist rounded-xl px-4 py-3 hover:bg-brand-mist/60 transition">
            <input type="checkbox" {...reg} className="w-5 h-5 accent-brand-navy" />
            <span className="text-sm font-bold text-brand-charcoal">{label}</span>
        </label>
    );
}

export default function CourseForm({ courseId }: { courseId?: string }) {
    const { t } = useI18n();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [loadingInit, setLoadingInit] = useState(!!courseId);

    const [coverUrl, setCoverUrl] = useState('');
    const [videoFileUrl, setVideoFileUrl] = useState('');
    const [gallery, setGallery] = useState<string[]>([]);
    const [objectives, setObjectives] = useState<ObjectiveDraft[]>([]);
    const [prerequisites, setPrereq] = useState<PrereqDraft[]>([]);
    const [audiences, setAudiences] = useState<AudienceDraft[]>([]);
    const [faqs, setFaqs] = useState<FaqDraft[]>([]);
    const [chapters, setChapters] = useState<ChapterDraft[]>([]);

    const coverRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);

    const [currentStep, setCurrentStep] = useState(0);

    const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<FormValues>({
        defaultValues: buildValues(undefined),
    });

    useEffect(() => {
        if (!courseId) return;
        let active = true;
        const load = async () => {
            try {
                const res = await api.get(`/courses/${courseId}`);
                const data = res.data as CourseInitial;
                if (!active) return;
                reset(buildValues(data));
                setCoverUrl(strVal(data.coverImageUrl));
                setVideoFileUrl(strVal(data.videoFileUrl));
                setGallery((data.gallery || []).map(g => g.url));
                setObjectives((data.objectives || []).map(o => ({ objectiveAr: o.objectiveAr, objectiveEn: o.objectiveEn })));
                setPrereq((data.prerequisites || []).map(p => ({ prerequisiteAr: p.prerequisiteAr, prerequisiteEn: p.prerequisiteEn })));
                setAudiences((data.audiences || []).map(a => ({ audienceAr: a.audienceAr, audienceEn: a.audienceEn })));
                setFaqs((data.faqs || []).map(f => ({ questionAr: f.questionAr, questionEn: f.questionEn, answerAr: f.answerAr, answerEn: f.answerEn })));
                setChapters((data.chapters && data.chapters.length
                    ? data.chapters
                    : (data.modules || []).length ? [{ titleAr: '', titleEn: '', modules: data.modules! }] : []
                ).map(ch => ({
                    titleAr: strVal(ch.titleAr),
                    titleEn: strVal(ch.titleEn),
                    modules: (ch.modules || []).map(toModuleDraft),
                })));
            } catch {
                toast.error(t('courseDetail.failed_load'));
            } finally {
                if (active) setLoadingInit(false);
            }
        };
        load();
        return () => { active = false; };
    }, [courseId, t, reset]);

    const uploadFile = async (file: File, kind: string) => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post(`/api/admin/courses/media?kind=${kind}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.url as string;
    };

    const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingMedia(true);
        try {
            const url = await uploadFile(file, 'cover');
            setCoverUrl(url);
            toast.success(t('createCourse.add'));
        } catch {
            toast.error(t('createCourse.upload_failed'));
        } finally {
            setUploadingMedia(false);
            if (coverRef.current) coverRef.current.value = '';
        }
    };

    const handleGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingMedia(true);
        try {
            const urls: string[] = [];
            for (const file of Array.from(files)) {
                urls.push(await uploadFile(file, 'gallery'));
            }
            setGallery(prev => [...prev, ...urls]);
        } catch {
            toast.error(t('createCourse.upload_failed'));
        } finally {
            setUploadingMedia(false);
            if (galleryRef.current) galleryRef.current.value = '';
        }
    };

    const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingMedia(true);
        try {
            const url = await uploadFile(file, 'video');
            setVideoFileUrl(url);
        } catch {
            toast.error(t('createCourse.upload_failed'));
        } finally {
            setUploadingMedia(false);
            if (videoRef.current) videoRef.current.value = '';
        }
    };

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true);
        try {
            const num = (v: string) => (v !== '' && v !== null && v !== undefined ? Number(v) : null);
            const isLive = data.contentType !== 'RECORDED';
            const payload: Record<string, unknown> = {
                titleAr: data.titleAr,
                titleEn: data.titleEn,
                excerptAr: data.excerptAr || null,
                excerptEn: data.excerptEn || null,
                descriptionAr: data.descriptionAr || null,
                descriptionEn: data.descriptionEn || null,
                categoryAr: data.categoryAr || null,
                categoryEn: data.categoryEn || null,
                level: data.level || 'BEGINNER',
                contentType: data.contentType || 'LIVE',
                language: data.language || null,
                hoursOfContent: num(data.hoursOfContent),
                syllabusAr: data.syllabusAr || null,
                syllabusEn: data.syllabusEn || null,
                durationAr: data.durationAr || null,
                durationEn: data.durationEn || null,
                coverImageUrl: coverUrl || null,
                introVideoUrl: data.introVideoUrl || null,
                videoFileUrl: videoFileUrl || null,
                certificateIssued: !!data.certificateIssued,
                quizzesIncluded: !!data.quizzesIncluded,
                projectsIncluded: !!data.projectsIncluded,
                assignmentsIncluded: !!data.assignmentsIncluded,
                liveSessionsIncluded: !!data.liveSessionsIncluded,
                downloadableResources: !!data.downloadableResources,
                lifetimeAccess: !!data.lifetimeAccess,
                communityAccess: !!data.communityAccess,
                objectives: objectives.map((o, i) => ({ ...o, orderIndex: i })).filter(o => o.objectiveAr || o.objectiveEn),
                prerequisites: prerequisites.map((p, i) => ({ ...p, orderIndex: i })).filter(p => p.prerequisiteAr || p.prerequisiteEn),
                audiences: audiences.map((a, i) => ({ ...a, orderIndex: i })).filter(a => a.audienceAr || a.audienceEn),
                faqs: faqs.map((f, i) => ({ ...f, orderIndex: i })).filter(f => f.questionAr || f.questionEn),
                gallery: gallery.map((url, i) => ({ url, orderIndex: i })),
                chapters: chapters.map((ch, ci) => ({
                    titleAr: ch.titleAr,
                    titleEn: ch.titleEn,
                    orderIndex: ci,
                    modules: ch.modules.map((m, i) => ({
                        titleAr: m.titleAr,
                        titleEn: m.titleEn,
                        descriptionAr: m.descriptionAr || null,
                        descriptionEn: m.descriptionEn || null,
                        // A live course's lessons ARE the meetings, so the video is
                        // dropped here rather than sent and rejected by the API.
                        videoUrl: isLive ? null : (m.videoUrl || null),
                        orderIndex: i,
                        durationMinutes: m.durationMinutes !== '' ? Number(m.durationMinutes) : null,
                        files: m.files.map(f => ({ ...f })).filter(f => f.url),
                        links: m.links.map(l => ({ ...l })).filter(l => l.url),
                        outcomes: m.outcomes.map((o) => ({ ...o })).filter(o => o.descriptionAr || o.descriptionEn),
                    })).filter(m => m.titleAr || m.titleEn),
                })).filter(ch => ch.titleAr || ch.titleEn || ch.modules.length > 0),
            };

            if (courseId) {
                await api.patch(`/api/admin/courses/${courseId}`, payload);
                toast.success(t('createCourse.updated'));
            } else {
                await api.post('/api/admin/courses', payload);
                toast.success(t('createCourse.created'));
            }
            router.push('/dashboard/admin/courses');
        } catch (err) {
            toast.error(getErrorMessage(err) || t('createCourse.failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputCls = "w-full px-4 py-3 bg-brand-mist/20 border border-brand-mist rounded-xl focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition placeholder:text-gray-400";
    const dualGrid = "grid md:grid-cols-2 gap-3";

    const updateChapterModule = (ci: number, mi: number, patch: Partial<ModuleDraft>) => {
        setChapters(prev => prev.map((ch, i) => i === ci ? { ...ch, modules: ch.modules.map((mod, j) => j === mi ? { ...mod, ...patch } : mod) } : ch));
    };
    const removeChapterModule = (ci: number, mi: number) => {
        setChapters(prev => prev.map((ch, i) => i === ci ? { ...ch, modules: ch.modules.filter((_, j) => j !== mi) } : ch));
    };
    const addChapterModule = (ci: number) => {
        setChapters(prev => prev.map((ch, i) => i === ci ? { ...ch, modules: [...ch.modules, newModuleDraft()] } : ch));
    };
    const langTag = (label: string) => (
        <span className="inline-block bg-brand-mist text-brand-charcoal text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider mb-1">{label}</span>
    );

    const goNext = useCallback(() => setCurrentStep(s => Math.min(s + 1, STEPS.length - 1)), []);
    const goBack = useCallback(() => setCurrentStep(s => Math.max(s - 1, 0)), []);

    if (loadingInit) {
        return <div className="min-h-screen flex items-center justify-center text-brand-navy"><Loader className="animate-spin" size={48} /></div>;
    }

    const watchAll = watch();

    const ReviewCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div className="border border-brand-mist rounded-2xl p-5 bg-white shadow-sm">
            <h4 className="font-black text-brand-navy mb-3 text-sm uppercase tracking-wider">{title}</h4>
            <div className="space-y-2 text-sm text-gray-700">{children}</div>
        </div>
    );

    const ReviewRow = ({ label, value }: { label: string; value?: string | boolean | number | null }) => (
        <div className="flex justify-between gap-4">
            <span className="text-gray-500 font-medium shrink-0">{label}</span>
            <span className="font-semibold text-right text-brand-charcoal">{value ? String(value) : '—'}</span>
        </div>
    );

    const stepContent = (() => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="space-y-5">
                        <div>
                            {langTag('العربية')}
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.title_label')}</label>
                            <input {...register('titleAr', { required: t('createCourse.title_required') })} className={inputCls} placeholder={t('createCourse.title_placeholder')} />
                            {errors.titleAr && <p className="text-red-500 text-xs mt-1">{errors.titleAr.message}</p>}
                        </div>
                        <div>
                            {langTag('English')}
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.title_label')}</label>
                            <input {...register('titleEn', { required: t('createCourse.title_required') })} className={inputCls} placeholder="e.g. Advanced System Architecture" />
                            {errors.titleEn && <p className="text-red-500 text-xs mt-1">{errors.titleEn.message}</p>}
                        </div>
                        <div className={dualGrid}>
                            <div>
                                {langTag('Ar')}
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.excerpt_label')}</label>
                                <textarea {...register('excerptAr')} rows={2} className={inputCls} placeholder={t('createCourse.excerpt_placeholder')} />
                            </div>
                            <div>
                                {langTag('En')}
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.excerpt_label')}</label>
                                <textarea {...register('excerptEn')} rows={2} className={inputCls} placeholder="e.g. A hands-on course for..." />
                            </div>
                        </div>
                        <div className={dualGrid}>
                            <div>
                                {langTag('Ar')}
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.desc_label')}</label>
                                <textarea {...register('descriptionAr')} rows={4} className={inputCls} placeholder={t('createCourse.desc_placeholder')} />
                            </div>
                            <div>
                                {langTag('En')}
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.desc_label')}</label>
                                <textarea {...register('descriptionEn')} rows={4} className={inputCls} placeholder="What will the students learn?" />
                            </div>
                        </div>
                        <div className={dualGrid}>
                            <div>
                                {langTag('Ar')}
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.category_label')}</label>
                                <input {...register('categoryAr')} className={inputCls} placeholder={t('createCourse.category_placeholder')} />
                            </div>
                            <div>
                                {langTag('En')}
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.category_label')}</label>
                                <input {...register('categoryEn')} className={inputCls} placeholder="e.g. Programming, Design..." />
                            </div>
                        </div>
                        <div className={dualGrid}>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.level_label')}</label>
                                <select {...register('level')} className={inputCls}>
                                    <option value="" disabled>{t('course.level_placeholder')}</option>
                                    {LEVELS.map(l => (
                                        <option key={l} value={l}>{t(`course.level_${l.toLowerCase()}`)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    {t('createCourse.content_type_label')} <span className="text-red-500">*</span>
                                </label>
                                <select {...register('contentType')} className={inputCls}>
                                    {CONTENT_TYPES.map(c => (
                                        <option key={c} value={c}>{t(`createCourse.content_type_${c.toLowerCase()}`)}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">{t(`createCourse.content_type_hint_${(watchAll.contentType || 'LIVE').toLowerCase()}`)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.language_label')}</label>
                                <input {...register('language')} className={inputCls} placeholder={t('createCourse.language_placeholder')} />
                            </div>
                        </div>
                    </div>
                );
            case 1:
                return (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.cover_label')}</label>
                            <p className="text-xs text-gray-400 mb-2">{t('createCourse.cover_hint')}</p>
                            {coverUrl ? (
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`${API_BASE_URL}${coverUrl}`} alt="Cover" className="w-full h-56 object-cover rounded-xl border border-gray-200" />
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        <button type="button" onClick={() => coverRef.current?.click()} className="bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-sm font-bold text-brand-navy shadow hover:bg-white">
                                            {t('createCourse.change_cover')}
                                        </button>
                                        <button type="button" onClick={() => setCoverUrl('')} className="bg-red-500 text-white rounded-lg p-2 shadow hover:bg-red-600">
                                            <XCircle size={18} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={() => coverRef.current?.click()}
                                    className="border-2 border-dashed border-brand-gold/40 rounded-2xl p-8 flex flex-col items-center justify-center text-brand-navy font-semibold cursor-pointer hover:bg-brand-mist/50 transition group"
                                >
                                    <ImageIcon size={40} className="mb-3 text-brand-gold group-hover:scale-110 transition-transform" />
                                    <span>{t('createCourse.upload_cover')}</span>
                                    <input type="file" className="hidden" ref={coverRef} onChange={handleCoverFile} accept=".jpg,.jpeg,.png,.webp,.gif" />
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.gallery_label')}</label>
                            <p className="text-xs text-gray-400 mb-2">{t('createCourse.gallery_hint')}</p>
                            <div
                                onClick={() => galleryRef.current?.click()}
                                className="border-2 border-dashed border-brand-gold/40 rounded-2xl p-6 flex flex-col items-center justify-center text-brand-navy font-semibold cursor-pointer hover:bg-brand-mist/50 transition group"
                            >
                                <Plus size={32} className="mb-2 text-brand-gold group-hover:scale-110 transition-transform" />
                                <span>{t('createCourse.upload_gallery')}</span>
                                <input type="file" multiple className="hidden" ref={galleryRef} onChange={handleGalleryFiles} accept=".jpg,.jpeg,.png,.webp,.gif" />
                            </div>
                            {gallery.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                    {gallery.map((url, idx) => (
                                        <div key={idx} className="relative group min-w-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`${API_BASE_URL}${url}`} alt={`gallery-${idx}`} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                                            <button type="button" onClick={() => removeByIndex(setGallery, idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600">
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.intro_video_url_label')}</label>
                            <input {...register('introVideoUrl')} dir="ltr" className={inputCls} placeholder={t('createCourse.intro_video_url_placeholder')} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.video_file_label')}</label>
                            <p className="text-xs text-gray-400 mb-2">{t('createCourse.video_file_hint')}</p>
                            <div
                                onClick={() => videoRef.current?.click()}
                                className="border-2 border-dashed border-brand-gold/40 rounded-2xl p-6 flex flex-col items-center justify-center text-brand-navy font-semibold cursor-pointer hover:bg-brand-mist/50 transition group"
                            >
                                <Film size={32} className="mb-2 text-brand-gold group-hover:scale-110 transition-transform" />
                                <span>{videoFileUrl ? videoFileUrl.split('/').pop() : t('createCourse.upload_video')}</span>
                                <input type="file" className="hidden" ref={videoRef} onChange={handleVideoFile} accept=".mp4,.webm,.mov" />
                            </div>
                            {videoFileUrl && (
                                <button type="button" onClick={() => setVideoFileUrl('')} className="mt-2 text-red-500 text-sm font-bold hover:text-red-700 flex items-center gap-1">
                                    <XCircle size={16} /> {t('createCourse.remove')}
                                </button>
                            )}
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer bg-brand-gold/10 border border-brand-gold/30 rounded-xl px-4 py-3 hover:bg-brand-gold/20 transition">
                            <input type="checkbox" {...register('certificateIssued')} className="w-5 h-5 accent-brand-navy" />
                            <span className="text-sm font-bold text-brand-charcoal">{t('createCourse.certificate_label')}</span>
                        </label>
                        <div className="border-t border-brand-mist pt-5 mt-5">
                            <h4 className="text-sm font-black text-brand-charcoal mb-3">{t('createCourse.section_duration')}</h4>
                            <p className="text-xs text-gray-400 mb-3">{t('createCourse.section_duration_hint')}</p>
                            <div className={dualGrid}>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.hours_label')}</label>
                                    <input type="number" min={1} {...register('hoursOfContent')} className={inputCls} placeholder={t('createCourse.hours_placeholder')} />
                                </div>
                                <div className="flex items-end pb-1">
                                    <p className="text-xs text-gray-500">{t('createCourse.duration_note')}</p>
                                </div>
                            </div>
                            <div className={dualGrid}>
                                <div>
                                    {langTag('Ar')}
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.duration_label')}</label>
                                    <input {...register('durationAr')} className={inputCls} placeholder={t('createCourse.duration_placeholder')} />
                                </div>
                                <div>
                                    {langTag('En')}
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.duration_label')}</label>
                                    <input {...register('durationEn')} className={inputCls} placeholder="e.g. 12 Weeks" />
                                </div>
                            </div>
                            <div className="bg-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 text-sm text-brand-navy font-semibold mt-3">
                                {t('createCourse.pricing_moved_note')}
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-8">
                        <div>
                            <h4 className="font-black text-brand-navy text-sm uppercase tracking-wider mb-3">{t('createCourse.section_learning')}</h4>
                            {objectives.map((o, idx) => (
                                <div key={idx} className={dualGrid}>
                                    <div>
                                        {langTag('Ar')}
                                        <input value={o.objectiveAr} onChange={e => updateByIndex(setObjectives, idx, { objectiveAr: e.target.value })} className={inputCls} placeholder={t('createCourse.objective_ar_placeholder')} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            {langTag('En')}
                                            <input value={o.objectiveEn} onChange={e => updateByIndex(setObjectives, idx, { objectiveEn: e.target.value })} className={inputCls} placeholder={t('createCourse.objective_en_placeholder')} />
                                        </div>
                                        <button type="button" onClick={() => removeByIndex(setObjectives, idx)} className="bg-red-50 text-red-500 rounded-lg p-3 mb-0.5 hover:bg-red-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setObjectives(prev => [...prev, { objectiveAr: '', objectiveEn: '' }])} className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition">
                                <Plus size={18} /> {t('createCourse.add_objective')}
                            </button>
                        </div>
                        <div className="border-t border-brand-mist pt-6">
                            <h4 className="font-black text-brand-navy text-sm uppercase tracking-wider mb-3">{t('createCourse.section_prereq')}</h4>
                            {prerequisites.map((p, idx) => (
                                <div key={idx} className={dualGrid}>
                                    <div>
                                        {langTag('Ar')}
                                        <input value={p.prerequisiteAr} onChange={e => updateByIndex(setPrereq, idx, { prerequisiteAr: e.target.value })} className={inputCls} placeholder={t('createCourse.prereq_ar_placeholder')} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            {langTag('En')}
                                            <input value={p.prerequisiteEn} onChange={e => updateByIndex(setPrereq, idx, { prerequisiteEn: e.target.value })} className={inputCls} placeholder={t('createCourse.prereq_en_placeholder')} />
                                        </div>
                                        <button type="button" onClick={() => removeByIndex(setPrereq, idx)} className="bg-red-50 text-red-500 rounded-lg p-3 mb-0.5 hover:bg-red-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setPrereq(prev => [...prev, { prerequisiteAr: '', prerequisiteEn: '' }])} className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition">
                                <Plus size={18} /> {t('createCourse.add_prerequisite')}
                            </button>
                        </div>
                        <div className="border-t border-brand-mist pt-6">
                            <h4 className="font-black text-brand-navy text-sm uppercase tracking-wider mb-3">{t('createCourse.section_audience')}</h4>
                            {audiences.map((a, idx) => (
                                <div key={idx} className={dualGrid}>
                                    <div>
                                        {langTag('Ar')}
                                        <input value={a.audienceAr} onChange={e => updateByIndex(setAudiences, idx, { audienceAr: e.target.value })} className={inputCls} placeholder={t('createCourse.audience_ar_placeholder')} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            {langTag('En')}
                                            <input value={a.audienceEn} onChange={e => updateByIndex(setAudiences, idx, { audienceEn: e.target.value })} className={inputCls} placeholder={t('createCourse.audience_en_placeholder')} />
                                        </div>
                                        <button type="button" onClick={() => removeByIndex(setAudiences, idx)} className="bg-red-50 text-red-500 rounded-lg p-3 mb-0.5 hover:bg-red-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setAudiences(prev => [...prev, { audienceAr: '', audienceEn: '' }])} className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition">
                                <Plus size={18} /> {t('createCourse.add_audience')}
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-5">
                        <div>
                            {langTag('Ar')}
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.syllabus_label')}</label>
                            <textarea {...register('syllabusAr')} rows={4} className={inputCls} placeholder={t('createCourse.syllabus_placeholder')} />
                        </div>
                        <div>
                            {langTag('En')}
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('createCourse.syllabus_label')}</label>
                            <textarea {...register('syllabusEn')} rows={4} className={inputCls} placeholder="Course outline and modules..." />
                        </div>
                        <p className="text-xs text-gray-400">{t('createCourse.modules_hint')}</p>
                        {chapters.map((ch, ci) => (
                            <div key={ci} className="border-2 border-brand-navy/15 rounded-2xl p-5 bg-brand-mist/10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-black text-brand-navy">{t('createCourse.chapter_label')} #{ci + 1}</span>
                                    <button type="button" onClick={() => removeByIndex(setChapters, ci)} className="bg-red-50 text-red-500 rounded-lg p-2 hover:bg-red-100">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div className={dualGrid}>
                                    <div>
                                        {langTag('Ar')}
                                        <input value={ch.titleAr} onChange={e => updateByIndex(setChapters, ci, { titleAr: e.target.value })} className={inputCls} placeholder={t('createCourse.chapter_title_ar_placeholder')} />
                                    </div>
                                    <div>
                                        {langTag('En')}
                                        <input value={ch.titleEn} onChange={e => updateByIndex(setChapters, ci, { titleEn: e.target.value })} className={inputCls} placeholder={t('createCourse.chapter_title_en_placeholder')} />
                                    </div>
                                </div>
                                <div className="mt-4 space-y-4">
                                    {ch.modules.map((m, mi) => (
                                        <div key={mi} className="border border-brand-mist rounded-2xl p-5 bg-white shadow-sm space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-brand-navy">{t('createCourse.module_label')} #{mi + 1}</span>
                                                <button type="button" onClick={() => removeChapterModule(ci, mi)} className="bg-red-50 text-red-500 rounded-lg p-2 hover:bg-red-100">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                            <div className={dualGrid}>
                                                <div>
                                                    {langTag('Ar')}
                                                    <input value={m.titleAr} onChange={e => updateChapterModule(ci, mi, { titleAr: e.target.value })} className={inputCls} placeholder={t('createCourse.module_title_ar_placeholder')} />
                                                </div>
                                                <div>
                                                    {langTag('En')}
                                                    <input value={m.titleEn} onChange={e => updateChapterModule(ci, mi, { titleEn: e.target.value })} className={inputCls} placeholder={t('createCourse.module_title_en_placeholder')} />
                                                </div>
                                            </div>
                                            <div className={dualGrid}>
                                                <div>
                                                    {langTag('Ar')}
                                                    <textarea value={m.descriptionAr} rows={2} onChange={e => updateChapterModule(ci, mi, { descriptionAr: e.target.value })} className={inputCls} placeholder={t('createCourse.module_desc_ar_placeholder')} />
                                                </div>
                                                <div>
                                                    {langTag('En')}
                                                    <textarea value={m.descriptionEn} rows={2} onChange={e => updateChapterModule(ci, mi, { descriptionEn: e.target.value })} className={inputCls} placeholder={t('createCourse.module_desc_en_placeholder')} />
                                                </div>
                                            </div>
                                            {/* A live course's lessons happen at the meeting,
                                                so there is no video to attach. */}
                                            {watchAll.contentType !== 'LIVE' && (
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1"><Film size={14} /> {t('courseDetail.video_lesson')}</label>
                                                    <input value={m.videoUrl} dir="ltr" onChange={e => updateChapterModule(ci, mi, { videoUrl: e.target.value })} className={inputCls} placeholder={t('createCourse.module_video_placeholder')} />
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">{t('createCourse.module_duration_label')}</label>
                                                <input value={m.durationMinutes} type="number" min={0} dir="ltr" onChange={e => updateChapterModule(ci, mi, { durationMinutes: e.target.value })} className={inputCls} placeholder={t('createCourse.module_duration_placeholder')} />
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-brand-navy uppercase tracking-wider mb-2 flex items-center gap-1"><FileText size={14} /> {t('createCourse.module_files_heading')}</span>
                                                {m.files.map((f, j) => (
                                                    <div key={j} className="border border-brand-mist rounded-xl p-3 mb-2 bg-gray-50 space-y-2">
                                                        <input value={f.url} dir="ltr" onChange={e => {
                                                            const files = chapters[ci].modules[mi].files.map((x, k) => (k === j ? { ...x, url: e.target.value } : x));
                                                            updateChapterModule(ci, mi, { files });
                                                        }} className={inputCls} placeholder={t('createCourse.module_file_url_placeholder')} />
                                                        <div className={dualGrid}>
                                                            <input value={f.nameAr} onChange={e => {
                                                                const files = chapters[ci].modules[mi].files.map((x, k) => (k === j ? { ...x, nameAr: e.target.value } : x));
                                                                updateChapterModule(ci, mi, { files });
                                                            }} className={inputCls} placeholder={t('createCourse.module_file_name_ar_placeholder')} />
                                                            <input value={f.nameEn} onChange={e => {
                                                                const files = chapters[ci].modules[mi].files.map((x, k) => (k === j ? { ...x, nameEn: e.target.value } : x));
                                                                updateChapterModule(ci, mi, { files });
                                                            }} className={inputCls} placeholder={t('createCourse.module_file_name_en_placeholder')} />
                                                        </div>
                                                        <button type="button" onClick={() => {
                                                            const files = chapters[ci].modules[mi].files.filter((_, k) => k !== j);
                                                            updateChapterModule(ci, mi, { files });
                                                        }} className="flex items-center gap-1 text-xs text-red-500 font-bold hover:text-red-700 transition">
                                                            <Trash2 size={13} /> {t('common.delete')}
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => {
                                                    const files = [...chapters[ci].modules[mi].files, { url: '', nameAr: '', nameEn: '' }];
                                                    updateChapterModule(ci, mi, { files });
                                                }} className="flex items-center gap-1 text-sm text-brand-navy font-bold hover:text-brand-gold transition">
                                                    <Plus size={16} /> {t('createCourse.add_module_file')}
                                                </button>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-brand-navy uppercase tracking-wider mb-2 flex items-center gap-1"><Link2 size={14} /> {t('createCourse.module_links_heading')}</span>
                                                {m.links.map((l, j) => (
                                                    <div key={j} className="border border-brand-mist rounded-xl p-3 mb-2 bg-gray-50 space-y-2">
                                                        <input value={l.url} dir="ltr" onChange={e => {
                                                            const links = chapters[ci].modules[mi].links.map((x, k) => (k === j ? { ...x, url: e.target.value } : x));
                                                            updateChapterModule(ci, mi, { links });
                                                        }} className={inputCls} placeholder={t('createCourse.module_link_url_placeholder')} />
                                                        <div className={dualGrid}>
                                                            <input value={l.labelAr} onChange={e => {
                                                                const links = chapters[ci].modules[mi].links.map((x, k) => (k === j ? { ...x, labelAr: e.target.value } : x));
                                                                updateChapterModule(ci, mi, { links });
                                                            }} className={inputCls} placeholder={t('createCourse.module_link_label_ar_placeholder')} />
                                                            <input value={l.labelEn} onChange={e => {
                                                                const links = chapters[ci].modules[mi].links.map((x, k) => (k === j ? { ...x, labelEn: e.target.value } : x));
                                                                updateChapterModule(ci, mi, { links });
                                                            }} className={inputCls} placeholder={t('createCourse.module_link_label_en_placeholder')} />
                                                        </div>
                                                        <button type="button" onClick={() => {
                                                            const links = chapters[ci].modules[mi].links.filter((_, k) => k !== j);
                                                            updateChapterModule(ci, mi, { links });
                                                        }} className="flex items-center gap-1 text-xs text-red-500 font-bold hover:text-red-700 transition">
                                                            <Trash2 size={13} /> {t('common.delete')}
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => {
                                                    const links = [...chapters[ci].modules[mi].links, { url: '', labelAr: '', labelEn: '' }];
                                                    updateChapterModule(ci, mi, { links });
                                                }} className="flex items-center gap-1 text-sm text-brand-navy font-bold hover:text-brand-gold transition">
                                                    <Plus size={16} /> {t('createCourse.add_module_link')}
                                                </button>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-brand-navy uppercase tracking-wider mb-2">{t('createCourse.outcomes_heading')}</span>
                                                {m.outcomes.map((o, j) => (
                                                    <div key={j} className="flex items-end gap-2 mb-2">
                                                        <div className="flex-1">
                                                            {langTag('Ar')}
                                                            <input value={o.descriptionAr} onChange={e => {
                                                                const outcomes = chapters[ci].modules[mi].outcomes.map((x, k) => (k === j ? { ...x, descriptionAr: e.target.value } : x));
                                                                updateChapterModule(ci, mi, { outcomes });
                                                            }} className={inputCls} placeholder={t('createCourse.outcome_ar_placeholder')} />
                                                        </div>
                                                        <div className="flex-1">
                                                            {langTag('En')}
                                                            <input value={o.descriptionEn} onChange={e => {
                                                                const outcomes = chapters[ci].modules[mi].outcomes.map((x, k) => (k === j ? { ...x, descriptionEn: e.target.value } : x));
                                                                updateChapterModule(ci, mi, { outcomes });
                                                            }} className={inputCls} placeholder={t('createCourse.outcome_en_placeholder')} />
                                                        </div>
                                                        <button type="button" onClick={() => {
                                                            const outcomes = chapters[ci].modules[mi].outcomes.filter((_, k) => k !== j);
                                                            updateChapterModule(ci, mi, { outcomes });
                                                        }} className="bg-red-50 text-red-500 rounded-lg p-3 mb-0.5 hover:bg-red-100">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => {
                                                    const outcomes = [...chapters[ci].modules[mi].outcomes, { descriptionAr: '', descriptionEn: '' }];
                                                    updateChapterModule(ci, mi, { outcomes });
                                                }} className="flex items-center gap-1 text-sm text-brand-navy font-bold hover:text-brand-gold transition">
                                                    <Plus size={16} /> {t('createCourse.add_outcome')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => addChapterModule(ci)} className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition">
                                        <Plus size={18} /> {t('createCourse.add_module')}
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={() => setChapters(prev => [...prev, { titleAr: '', titleEn: '', modules: [] }])} className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition">
                            <Plus size={18} /> {t('createCourse.add_chapter')}
                        </button>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-8">
                        <div>
                            <h4 className="font-black text-brand-navy text-sm uppercase tracking-wider mb-3">{t('createCourse.section_features')}</h4>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <FeatureCheckbox reg={register('quizzesIncluded')} label={t('createCourse.feat_quizzes')} />
                                <FeatureCheckbox reg={register('projectsIncluded')} label={t('createCourse.feat_projects')} />
                                <FeatureCheckbox reg={register('assignmentsIncluded')} label={t('createCourse.feat_assignments')} />
                                <FeatureCheckbox reg={register('liveSessionsIncluded')} label={t('createCourse.feat_live_sessions')} />
                                <FeatureCheckbox reg={register('downloadableResources')} label={t('createCourse.feat_downloadable')} />
                                <FeatureCheckbox reg={register('lifetimeAccess')} label={t('createCourse.feat_lifetime')} />
                                <FeatureCheckbox reg={register('communityAccess')} label={t('createCourse.feat_community')} />
                            </div>
                        </div>
                        <div className="border-t border-brand-mist pt-6">
                            <h4 className="font-black text-brand-navy text-sm uppercase tracking-wider mb-3">{t('createCourse.section_faq')}</h4>
                            {faqs.map((f, idx) => (
                                <div key={idx} className="border border-brand-mist rounded-2xl p-5 bg-white shadow-sm space-y-3 mb-4">
                                    <div className={dualGrid}>
                                        <div>
                                            {langTag('Ar')}
                                            <input value={f.questionAr} onChange={e => updateByIndex(setFaqs, idx, { questionAr: e.target.value })} className={inputCls} placeholder={t('createCourse.faq_question_ar_placeholder')} />
                                        </div>
                                        <div>
                                            {langTag('En')}
                                            <input value={f.questionEn} onChange={e => updateByIndex(setFaqs, idx, { questionEn: e.target.value })} className={inputCls} placeholder={t('createCourse.faq_question_en_placeholder')} />
                                        </div>
                                    </div>
                                    <div className={dualGrid}>
                                        <div>
                                            {langTag('Ar')}
                                            <textarea value={f.answerAr} rows={2} onChange={e => updateByIndex(setFaqs, idx, { answerAr: e.target.value })} className={inputCls} placeholder={t('createCourse.faq_answer_ar_placeholder')} />
                                        </div>
                                        <div>
                                            {langTag('En')}
                                            <textarea value={f.answerEn} rows={2} onChange={e => updateByIndex(setFaqs, idx, { answerEn: e.target.value })} className={inputCls} placeholder={t('createCourse.faq_answer_en_placeholder')} />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeByIndex(setFaqs, idx)} className="text-red-500 text-sm font-bold hover:text-red-700 flex items-center gap-1">
                                        <Trash2 size={16} /> {t('createCourse.remove')}
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => setFaqs(prev => [...prev, { questionAr: '', questionEn: '', answerAr: '', answerEn: '' }])} className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition">
                                <Plus size={18} /> {t('createCourse.add_faq')}
                            </button>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="space-y-5">
                        <ReviewCard title={t('createCourse.section_basic')}>
                            <ReviewRow label={t('createCourse.title_label') + ' (Ar)'} value={watchAll.titleAr} />
                            <ReviewRow label={t('createCourse.title_label') + ' (En)'} value={watchAll.titleEn} />
                            <ReviewRow label={t('createCourse.excerpt_label') + ' (Ar)'} value={watchAll.excerptAr} />
                            <ReviewRow label={t('createCourse.excerpt_label') + ' (En)'} value={watchAll.excerptEn} />
                            <ReviewRow label={t('createCourse.desc_label') + ' (Ar)'} value={watchAll.descriptionAr} />
                            <ReviewRow label={t('createCourse.desc_label') + ' (En)'} value={watchAll.descriptionEn} />
                            <ReviewRow label={t('createCourse.category_label') + ' (Ar)'} value={watchAll.categoryAr} />
                            <ReviewRow label={t('createCourse.category_label') + ' (En)'} value={watchAll.categoryEn} />
                            <ReviewRow label={t('createCourse.level_label')} value={watchAll.level} />
                            <ReviewRow label={t('createCourse.content_type_label')} value={t(`createCourse.content_type_${(watchAll.contentType || 'LIVE').toLowerCase()}`)} />
                            <ReviewRow label={t('createCourse.language_label')} value={watchAll.language} />
                        </ReviewCard>
                        <ReviewCard title={t('createCourse.section_media')}>
                            <ReviewRow label={t('createCourse.cover_label')} value={coverUrl ? t('createCourse.add').replace(/^./, s => s.toUpperCase()) : null} />
                            <ReviewRow label={t('createCourse.gallery_label')} value={gallery.length > 0 ? `${gallery.length} ${t('common.items')}` : null} />
                            <ReviewRow label={t('createCourse.intro_video_url_label')} value={watchAll.introVideoUrl} />
                            <ReviewRow label={t('createCourse.video_file_label')} value={videoFileUrl ? videoFileUrl.split('/').pop() : null} />
                            <ReviewRow label={t('createCourse.certificate_label')} value={watchAll.certificateIssued ? '✓' : null} />
                            <ReviewRow label={t('createCourse.hours_label')} value={watchAll.hoursOfContent} />
                            <ReviewRow label={t('createCourse.duration_label') + ' (Ar)'} value={watchAll.durationAr} />
                            <ReviewRow label={t('createCourse.duration_label') + ' (En)'} value={watchAll.durationEn} />
                        </ReviewCard>
                        <ReviewCard title={t('createCourse.section_learning')}>
                            <p className="text-gray-500 mb-1">{t('createCourse.section_learning')}:</p>
                            {objectives.length > 0 ? objectives.map((o, i) => (
                                <div key={i} className="text-xs text-brand-charcoal">• {o.objectiveAr || o.objectiveEn || '—'}</div>
                            )) : <p className="text-xs text-gray-400">—</p>}
                            <p className="text-gray-500 mt-2 mb-1">{t('createCourse.section_prereq')}:</p>
                            {prerequisites.length > 0 ? prerequisites.map((p, i) => (
                                <div key={i} className="text-xs text-brand-charcoal">• {p.prerequisiteAr || p.prerequisiteEn || '—'}</div>
                            )) : <p className="text-xs text-gray-400">—</p>}
                            <p className="text-gray-500 mt-2 mb-1">{t('createCourse.section_audience')}:</p>
                            {audiences.length > 0 ? audiences.map((a, i) => (
                                <div key={i} className="text-xs text-brand-charcoal">• {a.audienceAr || a.audienceEn || '—'}</div>
                            )) : <p className="text-xs text-gray-400">—</p>}
                        </ReviewCard>
                        <ReviewCard title={t('createCourse.section_structure')}>
                            <ReviewRow label={t('createCourse.syllabus_label') + ' (Ar)'} value={watchAll.syllabusAr} />
                            <ReviewRow label={t('createCourse.syllabus_label') + ' (En)'} value={watchAll.syllabusEn} />
                            <div className="border-t border-brand-mist mt-3 pt-3">
                                {chapters.length > 0 ? chapters.map((ch, ci) => (
                                    <div key={ci} className="mb-3">
                                        <p className="font-bold text-brand-navy text-xs">{t('createCourse.chapter_label')} #{ci + 1}: {ch.titleEn || ch.titleAr || '—'}</p>
                                        {ch.modules.map((m, mi) => (
                                            <p key={mi} className="ml-4 text-xs text-gray-600">▸ {t('createCourse.module_label')} #{mi + 1}: {m.titleEn || m.titleAr || '—'}</p>
                                        ))}
                                    </div>
                                )) : <p className="text-xs text-gray-400">—</p>}
                            </div>
                        </ReviewCard>
                        <ReviewCard title={t('createCourse.section_features')}>
                            <div className="flex flex-wrap gap-2">
                                {watchAll.quizzesIncluded && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_quizzes')}</span>}
                                {watchAll.projectsIncluded && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_projects')}</span>}
                                {watchAll.assignmentsIncluded && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_assignments')}</span>}
                                {watchAll.liveSessionsIncluded && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_live_sessions')}</span>}
                                {watchAll.downloadableResources && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_downloadable')}</span>}
                                {watchAll.lifetimeAccess && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_lifetime')}</span>}
                                {watchAll.communityAccess && <span className="text-xs bg-brand-mist/50 px-3 py-1 rounded-full font-bold">{t('createCourse.feat_community')}</span>}
                            </div>
                        </ReviewCard>
                        <ReviewCard title={t('createCourse.section_faq')}>
                            {faqs.length > 0 ? faqs.map((f, i) => (
                                <div key={i} className="mb-2">
                                    <p className="font-bold text-xs text-brand-navy">Q: {f.questionEn || f.questionAr || '—'}</p>
                                    <p className="text-xs text-gray-500 ml-2">A: {f.answerEn || f.answerAr || '—'}</p>
                                </div>
                            )) : <p className="text-xs text-gray-400">—</p>}
                        </ReviewCard>
                    </div>
                );
            default:
                return null;
        }
    })();

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-brand-mist">
            <div className="mb-8">
                <PageHeader title={courseId ? t('createCourse.edit_heading') : t('createCourse.heading')} />
            </div>

            <div className="mb-10 overflow-x-auto">
                <div className="flex items-center justify-between min-w-[540px] px-2">
                    {STEPS.map((step, idx) => {
                        const isCompleted = idx < currentStep;
                        const isActive = idx === currentStep;
                        return (
                            <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 ${
                                            isCompleted
                                                ? 'bg-brand-gold text-white'
                                                : isActive
                                                    ? 'bg-gradient-to-br from-brand-navy to-brand-charcoal text-white shadow-lg shadow-brand-navy/30'
                                                    : 'bg-brand-mist/40 text-gray-400 border-2 border-brand-mist'
                                        }`}
                                    >
                                        {isCompleted ? <Check size={18} strokeWidth={3} /> : idx + 1}
                                    </div>
                                    <span className={`mt-2 text-[11px] font-bold text-center whitespace-nowrap transition-colors ${
                                        isActive ? 'text-brand-navy' : isCompleted ? 'text-brand-gold' : 'text-gray-400'
                                    }`}>
                                        {t(step.labelKey)}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`flex-1 h-[3px] mx-3 rounded-full transition-colors duration-300 -mt-4 ${
                                        idx < currentStep ? 'bg-brand-gold' : 'bg-brand-mist/50'
                                    }`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="min-h-[400px] transition-opacity duration-300">
                    {stepContent}
                </div>

                <div className="flex gap-4 pt-6 border-t border-brand-mist mt-8">
                    {currentStep > 0 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className="px-6 bg-brand-mist text-brand-navy font-bold py-3.5 rounded-xl hover:bg-brand-navy hover:text-white transition cursor-pointer"
                        >
                            {t('common.back') || 'Back'}
                        </button>
                    )}
                    {currentStep < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={goNext}
                            className="flex-1 bg-gradient-to-r from-brand-navy to-brand-charcoal text-white font-bold py-3.5 rounded-xl hover:opacity-95 shadow-md shadow-brand-navy/25 transition cursor-pointer"
                        >
                            {t('common.next') || 'Next'}
                        </button>
                    ) : (
                        <>
                            <button
                                type="submit"
                                disabled={isSubmitting || uploadingMedia}
                                className="flex-1 bg-gradient-to-r from-brand-navy to-brand-charcoal text-white font-bold py-3.5 rounded-xl hover:opacity-95 shadow-md shadow-brand-navy/25 transition disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? t('common.submitting') : courseId ? t('createCourse.updated') : t('createCourse.saving')}
                            </button>
                            <Link href="/dashboard/admin/courses" className="flex-1">
                                <button type="button" className="w-full bg-brand-mist text-brand-navy font-bold py-3.5 rounded-xl hover:bg-brand-navy hover:text-white transition cursor-pointer">
                                    {t('common.cancel')}
                                </button>
                            </Link>
                        </>
                    )}
                </div>
            </form>
            {uploadingMedia && (
                <div className="fixed inset-0 bg-brand-charcoal/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl border border-brand-mist p-8 flex flex-col items-center gap-3 shadow-2xl">
                        <Loader className="animate-spin text-brand-gold" size={40} />
                        <span className="font-bold text-brand-navy">{t('common.submitting')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
