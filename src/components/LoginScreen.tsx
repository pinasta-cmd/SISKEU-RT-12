import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Accessibility,
  ChevronLeft,
  ChevronRight,
  Lock,
  Moon,
  PhoneCall,
  ShieldCheck,
  Sun,
  WifiOff,
} from 'lucide-react';
import { getOfflineSnapshot } from '../lib/offlineSync';
import type { BannerSlide } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  isLoggingIn: boolean;
  loginError: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  elderlyMode: boolean;
  onToggleElderlyMode: () => void;
  isOnline: boolean;
  bannerSlides?: BannerSlide[];
}

interface SlideItem {
  id: string;
  title: string;
  subtitle: string;
  imageData: string;
}

const DEFAULT_FALLBACK_SLIDE: SlideItem = {
  id: 'default-rt-banner',
  title: 'Lingkungan RT 12 / RW 20 Sukatani',
  subtitle: 'Transparansi Kas Warga · Dokumentasi Kegiatan · Siaga Darurat Lingkungan',
  imageData: 'src/assets/images/porseni 2026.jpeg',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isLoggingIn,
  loginError,
  darkMode,
  onToggleDarkMode,
  elderlyMode,
  onToggleElderlyMode,
  isOnline,
  bannerSlides = [],
}) => {
  const [emblemFailed, setEmblemFailed] = useState(false);
  const [failedSlideIds, setFailedSlideIds] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const offlineSnapshot = getOfflineSnapshot();

  const slides: SlideItem[] = useMemo(() => {
    if (bannerSlides.length === 0) return [DEFAULT_FALLBACK_SLIDE];
    return bannerSlides.map((slide, idx) => ({
      id: slide.id || `slide-${idx}`,
      title: slide.title?.trim() || `Kegiatan Warga #${idx + 1}`,
      subtitle:
        slide.subtitle?.trim() ||
        'Dokumentasi Kegiatan & Transparansi Warga RT 12 / RW 20 Sukatani',
      imageData: slide.imageData,
    }));
  }, [bannerSlides]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isHovered) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length, isHovered]);

  const currentSlide = slides[activeIndex] || DEFAULT_FALLBACK_SLIDE;
  const currentSlideFailed = Boolean(failedSlideIds[currentSlide.id]);

  const handlePrevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {!emblemFailed ? (
              <img
                src="src/assets/images/app_emblem_icon_1795010549252.png"
                alt="Logo SISKEU RT12/RW20 SUKATANI"
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                RT
              </div>
            )}
            <div className="min-w-0">
              <span className="font-display text-sm sm:text-base font-extrabold tracking-tight block truncate">
                SISKEU RT12/RW20 SUKATANI
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                Sistem Keuangan &amp; Siaga Warga
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onToggleElderlyMode}
              aria-pressed={elderlyMode}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                elderlyMode
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Accessibility className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Teks Besar</span>
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100dvh-4rem)]">
        {/* Full-Height Edge-to-Edge Activity Photo Slideshow */}
        <section
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="lg:col-span-7 xl:col-span-8 relative min-h-[340px] sm:min-h-[420px] lg:min-h-full bg-slate-900 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentSlide.id}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.25 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.25 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' }}
              className="absolute inset-0 w-full h-full"
            >
              {!currentSlideFailed ? (
                <img
                  src={currentSlide.imageData}
                  alt={currentSlide.title}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedSlideIds((prev) => ({ ...prev, [currentSlide.id]: true }))
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 flex items-center justify-center p-8 text-white text-center">
                  <p className="text-lg font-bold">{currentSlide.title}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Previous / Next Controls */}
          {slides.length > 1 && (
            <div
              className={`absolute inset-y-0 inset-x-4 z-10 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <button
                type="button"
                onClick={handlePrevSlide}
                aria-label="Foto kegiatan sebelumnya"
                className={`${
                  isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                } min-h-[44px] min-w-[44px] rounded-full bg-slate-950/55 hover:bg-slate-950/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                aria-label="Foto kegiatan berikutnya"
                className={`${
                  isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                } min-h-[44px] min-w-[44px] rounded-full bg-slate-950/55 hover:bg-slate-950/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Bottom caption & slide indicators */}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent p-6 sm:p-8 lg:p-10 pt-20">
            <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1.5 leading-snug max-w-2xl">
              {currentSlide.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 mt-1.5 max-w-2xl line-clamp-2">
              {currentSlide.subtitle}
            </p>

            {slides.length > 1 && (
              <div
                className="mt-5 flex items-center gap-1.5"
                role="tablist"
                aria-label="Pilih foto kegiatan"
              >
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeIndex}
                    aria-label={`Tampilkan foto ${idx + 1}: ${slide.title}`}
                    onClick={() => setActiveIndex(idx)}
                    className="min-h-[28px] flex-1 max-w-[56px] flex items-center cursor-pointer group"
                  >
                    <span
                      className={`block w-full h-1.5 rounded-full transition-all ${
                        idx === activeIndex
                          ? 'bg-emerald-400'
                          : 'bg-white/35 group-hover:bg-white/60'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Full-Height Right Panel: Modern Login Portal & Offline Emergency Quick-Dial */}
        <section className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between px-6 sm:px-8 lg:px-10 pt-3 pb-6 gap-6">
          <div className="flex-1 flex flex-col justify-start">
            <h1 className="mt-0 font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.18] text-slate-900 dark:text-slate-50 [text-wrap:balance]">              
              Portal Sistem Keuangan &amp; Siaga Warga RT 12 / RW 20 Sukatani
            </h1>

            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Pantau kas RT secara terbuka, iuran bulanan, cek laporan bulanan, dan akses layanan darurat.
            </p>

            {/* Auth Box */}
            <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Autentikasi Akun Terverifikasi
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Masuk satu klik dengan akun Google Anda. Hak akses sebagai Warga atau Bendahara/Admin RT terdeteksi otomatis.
                </p>
              </div>

              {!isOnline && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3.5 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <p className="font-bold">Perangkat sedang offline</p>
                    <p className="mt-0.5">
                      Masuk pertama kali membutuhkan koneksi internet. Nomor darurat &amp; kartu medis tersimpan tetap aktif di bawah.
                    </p>
                  </div>
                </div>
              )}

              {loginError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-xs font-medium text-red-800 dark:text-red-200"
                >
                  {loginError}
                </div>
              )}

              <button
                type="button"
                onClick={() => void onLogin()}
                disabled={isLoggingIn || !isOnline}
                className="w-70 h-12 max-w-xs mx-auto px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-sm transition-all cursor-pointer"              >
                <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                </span>
                <span>
                  {isLoggingIn ? 'Menghubungkan Akun...' : 'Masuk dengan Akun Google'}
                </span>
              </button>

              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Auth 2.0 Terverifikasi Enkripsi AES-256-GCM Sinkronisasi Offline
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Enkripsi Data Pribadi
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Profil kesehatan &amp; kontak darurat dienkripsi di perangkat.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Ramah Lansia &amp; Offline
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Mode teks besar &amp; pencatatan tetap siap tanpa sinyal penuh.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Offline Emergency Quick-Dial Card */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Akses Cepat Panggilan Darurat Offline
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Tersedia langsung tanpa perlu sinyal internet penuh
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <a
                href={`tel:${offlineSnapshot?.rtSettings?.emergencyPhoneRT || '112'}`}
                className="min-h-[46px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span>Darurat {offlineSnapshot?.rtSettings?.emergencyPhoneRT || '112'}</span>
              </a>
              <a
                href={`tel:${offlineSnapshot?.rtSettings?.emergencyPhoneMedical || '118'}`}
                className="min-h-[46px] px-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 text-red-800 dark:text-red-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span>Medis {offlineSnapshot?.rtSettings?.emergencyPhoneMedical || '118'}</span>
              </a>
            </div>

            {offlineSnapshot && offlineSnapshot.medicalSummary && (
              <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Kartu Medis Tersimpan ({offlineSnapshot.residentName} · {offlineSnapshot.houseBlock}):
                </span>{' '}
                {offlineSnapshot.medicalSummary}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
