"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_BASE_URL } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";
import { useTheme } from "@/lib/theme-context";
import { ChevronLeft, ChevronRight, Play, X, Megaphone } from "lucide-react";

interface BannerItem {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string | null;
  bodyEn?: string | null;
  mediaType: string;
  mediaUrl?: string | null;
  linkUrl?: string | null;
  priority: number;
  durationSeconds: number;
}

interface AnnouncementBannerProps {
  variant?: "dashboard" | "public";
  dark?: boolean;
}

export default function AnnouncementBanner({
  variant = "dashboard",
  dark,
}: AnnouncementBannerProps) {
  const { t, locale } = useI18n();
  const { dark: ctxDark } = useTheme();
  const [items, setItems] = useState<BannerItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [videoModal, setVideoModal] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/announcement-board/active");
      setItems(res.data || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const dur = (items[current]?.durationSeconds || 5) * 1000;
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % items.length), dur);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length, isPaused, current]);

  if (loading || items.length === 0) return null;

  const item = items[current];
  const isDark = variant === "dashboard" || (dark ?? ctxDark);
  const hasMedia = item.mediaType !== "none" && item.mediaUrl;
  const text = (locale === "ar" ? item.titleAr || item.titleEn : item.titleEn || item.titleAr) || "";
  const body = (locale === "ar" ? item.bodyAr || item.bodyEn : item.bodyEn || item.bodyAr) || "";

  const goTo = (i: number) => setCurrent(i);
  const next = () => setCurrent((p) => (p + 1) % items.length);
  const prev = () => setCurrent((p) => (p - 1 + items.length) % items.length);

  const getVideoEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch")) {
      const v = new URL(url).searchParams.get("v");
      return "https://www.youtube.com/embed/" + v + "?autoplay=1";
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return "https://www.youtube.com/embed/" + id + "?autoplay=1";
    }
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split("?")[0];
      return "https://player.vimeo.com/video/" + id + "?autoplay=1";
    }
    return url;
  };

  const sk = item.id + "-" + current;

  return (
    <>
      <div
        className={"relative w-full overflow-hidden group " + (hasMedia ? "rounded-2xl md:rounded-3xl" : isDark ? "bg-brand-navy-dark border border-white/[0.06] rounded-2xl md:rounded-3xl" : "bg-white border border-brand-gold-light/70/40 rounded-2xl md:rounded-3xl")}
        style={hasMedia ? { height: 200 } : { minHeight: 140 }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {item.mediaType === "image" && item.mediaUrl && (
          <img key={"i-" + sk} src={API_BASE_URL + item.mediaUrl} alt={text} className="absolute inset-0 w-full h-full object-contain" />
        )}

        {item.mediaType === "video" && item.mediaUrl && (
          <>
            <img key={"v-" + sk} src={API_BASE_URL + item.mediaUrl} alt={text} className="absolute inset-0 w-full h-full object-contain" />
            <button onClick={() => setVideoModal(getVideoEmbedUrl(item.mediaUrl!))} className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                <Play size={36} className="text-[#1a2742] ml-1.5" />
              </div>
            </button>
          </>
        )}

        {!hasMedia && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              {isDark ? (
                <>
                  <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-gold/[0.06] rounded-full blur-3xl" />
                  <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-brand-navy-light/[0.04] rounded-full blur-3xl" />
                </>
              ) : (
                <>
                  <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-gold-light/[0.08] rounded-full blur-3xl" />
                  <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-brand-gold-dark/[0.05] rounded-full blur-3xl" />
                </>
              )}
            </div>
            <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 py-8 text-center">
              <span className={"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase mb-3 " + (isDark ? "bg-brand-gold/15 text-brand-gold-light ring-1 ring-brand-gold/20" : "bg-brand-gold/10 text-brand-gold-dark ring-1 ring-brand-gold-light/70")}>
                <Megaphone size={12} />
                {isDark ? "ANNOUNCEMENT" : "إعلان"}
              </span>
              <h2 className={"font-black text-2xl md:text-3xl lg:text-4xl leading-tight max-w-3xl " + (isDark ? "text-white" : "text-[#1a2742]")}>{text}</h2>
              {body && <p className={"text-base md:text-lg mt-3 max-w-2xl leading-relaxed " + (isDark ? "text-gray-300" : "text-gray-600")}>{body}</p>}
              {item.linkUrl && (
                <a href={item.linkUrl} target="_blank" rel="noreferrer" className={"inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] " + (isDark ? "bg-brand-gold text-[#0d1a30] hover:bg-brand-gold-light shadow-lg shadow-brand-gold/25" : "bg-[#1a2742] text-white hover:bg-[#253554] shadow-lg")}>
                  {t("announcementBanner.learn_more")}
                  <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </a>
              )}
            </div>
          </>
        )}

        {hasMedia && (
          <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent pt-10 pb-4 px-5 md:px-8">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone size={11} className="text-brand-gold-light shrink-0" />
                  <span className="text-[10px] font-bold text-brand-gold-light uppercase tracking-wider">{isDark ? "ANNOUNCEMENT" : "إعلان"}</span>
                  {items.length > 1 && <span className="text-[10px] text-white/40 font-medium">{current + 1}/{items.length}</span>}
                </div>
                <h3 className="font-black text-lg md:text-xl text-white leading-snug drop-shadow-lg">{text}</h3>
                {body && <p className="text-sm text-white/70 mt-1 line-clamp-2 max-w-lg">{body}</p>}
                {item.linkUrl && (
                  <a href={item.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-brand-gold-light hover:text-brand-gold-light transition">
                    {t("announcementBanner.learn_more")}
                    <svg className="w-3.5 h-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {items.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm flex items-center justify-center transition opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 z-20"><ChevronLeft size={18} /></button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm flex items-center justify-center transition opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 z-20"><ChevronRight size={18} /></button>
          </>
        )}

        {items.length > 1 && (
          <div className="absolute bottom-0 inset-x-0 z-20">
            <div className="flex items-center gap-1.5 px-4 pb-3 pt-8 bg-gradient-to-t from-black/40 to-transparent">
              {items.map((it, i) => (
                <button key={i} onClick={() => goTo(i)} className="flex-1 h-1 rounded-full overflow-hidden bg-white/15 relative">
                  {i === current && (
                    <div
                      className="absolute inset-y-0 left-0 bg-brand-gold rounded-full"
                      key={"bar-" + current + "-" + isPaused}
                      style={{
                        animation: isPaused ? "none" : "shrink " + (it.durationSeconds || 5) + "s linear forwards",
                        width: isPaused ? "100%" : undefined,
                      }}
                    />
                  )}
                  {i < current && <div className="absolute inset-y-0 left-0 w-full bg-brand-gold/50 rounded-full" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {videoModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVideoModal(null)}>
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setVideoModal(null)} className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition backdrop-blur-sm"><X size={20} /></button>
            <iframe src={videoModal} className="w-full h-full rounded-2xl" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        </div>
      )}
    </>
  );
}
