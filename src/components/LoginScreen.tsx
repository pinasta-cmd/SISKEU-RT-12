import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Accessibility,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Moon,
  PhoneCall,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
  WifiOff,
} from 'lucide-react';
import { getOfflineSnapshot } from '../lib/offlineSync';
import type { BannerSlide, LoginRole } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  onLoginWithCredentials: (data: {
    role: LoginRole;
    username: string;
    password: string;
  }) => Promise<void>;
  onRegisterAccount: (data: {
    role: LoginRole;
    fullName: string;
    houseBlock: string;
    username: string;
    password: string;
  }) => Promise<void>;
  onGoogleAdminLogin: () => Promise<void>;
  isLoggingIn: boolean;
  loginError: string | null;
  onClearError: () => void;
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
  title: 'Portal RT 12 / RW 20 Sukatani',
  subtitle: 'Transparansi Kas Warga · Dokumentasi Kegiatan Lingkungan',
  imageData: 'src/assets/images/porseni 2026.jpeg',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginWithCredentials,
  onRegisterAccount,
  onGoogleAdminLogin,
  isLoggingIn,
  loginError,
  onClearError,
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

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<LoginRole>('warga');
  const [fullName, setFullName] = useState('');
  const [houseBlock, setHouseBlock] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const shouldReduceMotion = useReducedMotion();
  const offlineSnapshot = getOfflineSnapshot();

  const handleSwitchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setLocalError(null);
    onClearError();
  };

  const handleSelectRole = (role: LoginRole) => {
    setSelectedRole(role);
    setLocalError(null);
    onClearError();
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!username.trim() || !password) {
      setLocalError('Masukkan username dan sandi Anda.');
      return;
    }
    await onLoginWithCredentials({
      role: selectedRole,
      username: username.trim(),
      password,
    });
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!fullName.trim() || !houseBlock.trim()) {
      setLocalError('Nama Lengkap dan Blok Rumah wajib diisi sesuai database warga.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
      setLocalError('Username harus 3–30 karakter (huruf, angka, garis bawah _, atau tanda hubung -).');
      return;
    }
    if (password.length < 6) {
      setLocalError('Sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Konfirmasi sandi tidak cocok.');
      return;
    }
    await onRegisterAccount({
      role: selectedRole,
      fullName: fullName.trim(),
      houseBlock: houseBlock.trim(),
      username: username.trim(),
      password,
    });
  };

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
              {/* Role Selector: Warga vs Pengurus */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Pilih Role Akses
                </p>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSelectRole('warga')}
                    className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedRole === 'warga'
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>Warga</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole('pengurus')}
                    className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedRole === 'pengurus'
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Pengurus</span>
                  </button>
                </div>
              </div>

              {/* Mode Tabs: Masuk vs Daftar Akun */}
              <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className={`min-h-[40px] text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'login'
                      ? 'border-emerald-700 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className={`min-h-[40px] text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'register'
                      ? 'border-emerald-700 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Daftar Akun</span>
                </button>
              </div>

              {!isOnline && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3.5 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <p className="font-bold">Perangkat sedang offline</p>
                    <p className="mt-0.5">
                      Masuk atau pendaftaran akun membutuhkan koneksi internet. Nomor darurat &amp; kartu medis tersimpan tetap aktif di bawah.
                    </p>
                  </div>
                </div>
              )}

              {(localError || loginError) && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-xs font-medium text-red-800 dark:text-red-200 leading-relaxed"
                >
                  {localError || loginError}
                </div>
              )}

              {authMode === 'login' ? (
                <form onSubmit={(e) => void handleSubmitLogin(e)} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username ({selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'})
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="Masukkan Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sandi
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="Masukkan sandi Anda"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !isOnline}
                    className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>
                      {isLoggingIn
                        ? 'Memeriksa Akun...'
                        : `Masuk sebagai ${selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'}`}
                    </span>
                  </button>

                  <p className="text-xs text-center text-slate-600 dark:text-slate-400 pt-1">
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('register')}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Daftar Akun Terlebih Dahulu
                    </button>
                  </p>

                  {selectedRole === 'pengurus' && (
                    <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
                      <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                        Atau masuk khusus Admin Utama Google untuk kelola Database Warga
                      </p>
                      <button
                        type="button"
                        onClick={() => void onGoogleAdminLogin()}
                        disabled={isLoggingIn || !isOnline}
                        className="w-full min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                        <span>Masuk Admin Google</span>
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <form onSubmit={(e) => void handleSubmitRegister(e)} className="space-y-3">
                  <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Pendaftaran akun{' '}
                    <strong>{selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'}</strong>{' '}
                    diverifikasi dengan <strong>Database Warga RT 12 / RW 20</strong>. Jika Nama Lengkap atau Blok Rumah tidak sesuai database warga, pendaftaran akan ditolak.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Lengkap (Sesuai Database Warga)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={75}
                      placeholder="Contoh: Firman Mahameru"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Blok Rumah
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={25}
                      placeholder="Contoh: FF3/5"
                      value={houseBlock}
                      onChange={(e) => setHouseBlock(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      placeholder="Contoh: Budi_01)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sandi (Min. 6 karakter)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full min-h-[42px] pl-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ulangi Sandi
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Ketik ulang sandi"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !isOnline}
                    className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span>
                      {isLoggingIn
                        ? 'Memverifikasi Database Warga...'
                        : `Daftarkan Akun ${selectedRole === 'pengurus' ? 'Pengurus' : 'Warga'}`}
                    </span>
                  </button>

                  <p className="text-xs text-center text-slate-600 dark:text-slate-400 pt-1">
                    Sudah mendaftarkan akun?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Masuk di Sini
                    </button>
                  </p>
                </form>
              )}

              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Auth Terverifikasi · Enkripsi AES-256-GCM · Sinkronisasi Offline
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
