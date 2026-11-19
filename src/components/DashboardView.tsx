import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileBarChart2,
  HeartPulse,
  Megaphone,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type {
  Announcement,
  AppTab,
  EmergencyAlert,
  KasTransaction,
  ResidentPublic,
  RtSettings,
} from '../types';
import {
  calculateResidentLedger,
  CATEGORY_LABELS,
  FAMILY_STATUS_LABELS,
  formatMonthLabel,
  formatRupiah,
  formatTimestamp,
  getCurrentYearMonth,
  getResidentMonthDuesSummary,
} from '../utils/format';

interface DashboardViewProps {
  profile: ResidentPublic;
  isAdmin: boolean;
  rtSettings: RtSettings;
  transactions: KasTransaction[];
  residents: ResidentPublic[];
  announcements: Announcement[];
  emergencies: EmergencyAlert[];
  onNavigate: (tab: AppTab) => void;
  onOpenTutorial: () => void;
  onQuickPayDues: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  isAdmin,
  rtSettings,
  transactions,
  residents,
  announcements,
  emergencies,
  onNavigate,
  onOpenTutorial,
  onQuickPayDues,
}) => {
  const [copiedBank, setCopiedBank] = useState(false);

  const currentMonth = getCurrentYearMonth();
  const approvedTx = transactions.filter(
    (t) => t.status === 'approved' || t.status === 'kurang_bayar'
  );
  const totalIncome = approvedTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpense = approvedTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const pendingVerificationCount = transactions.filter((t) => t.status === 'pending').length;

  const myDuesSummary = getResidentMonthDuesSummary(profile, transactions, currentMonth);
  const myFamilyLabel = FAMILY_STATUS_LABELS[myDuesSummary.familyStatus];

  const residentMap = new Map(residents.map((r) => [r.uid, r]));
  const paidResidentsCount = residents.filter(
    (r) => getResidentMonthDuesSummary(r, transactions, currentMonth).status === 'lunas'
  ).length;
  const totalResidentsCount = Math.max(residents.length, 1);
  const paymentProgressPct = Math.min(100, Math.round((paidResidentsCount / totalResidentsCount) * 100));

  const activeEmergencies = emergencies.filter((e) => e.status !== 'resolved');
  const recentTx = transactions.slice(0, 5);
  const latestAnnouncements = announcements.slice(0, 3);

  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (paymentProgressPct / 100) * ringCircumference;

  const handleCopyAccount = async () => {
    if (!rtSettings.bankAccountNumber) return;
    try {
      const cleanAccountNumber = rtSettings.bankAccountNumber.replace(/\D/g, '');
      await navigator.clipboard.writeText(cleanAccountNumber);
      setCopiedBank(true);
      window.setTimeout(() => setCopiedBank(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Emergency Banner if any */}
      {activeEmergencies.length > 0 && (
        <div className="rounded-2xl bg-red-600 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {activeEmergencies.length} Sinyal Darurat Aktif di Lingkungan
              </h2>
              <p className="text-sm text-red-100 mt-0.5 leading-relaxed">
                {activeEmergencies[0].reporterName} ({activeEmergencies[0].houseBlock}) ·{' '}
                {activeEmergencies[0].emergencyType.toUpperCase()} —{' '}
                {activeEmergencies[0].description || 'Membutuhkan bantuan segera'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('darurat')}
            className="min-h-[44px] px-4 rounded-xl bg-white text-red-700 font-bold text-sm hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lihat Detail Darurat
          </button>
        </div>
      )}

      {/* Dominant Visual Anchor: Architectural Emerald Treasury + Resident Dues Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 dark:from-emerald-950 dark:via-emerald-900 dark:to-slate-900 text-white p-6 sm:p-7 flex flex-col justify-between border border-emerald-700/70 dark:border-emerald-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-200/90">
                {rtSettings.rtName} · {rtSettings.rwName} · {rtSettings.kelurahan}
              </p>
              <p className="mt-4 text-sm font-medium text-emerald-100">Total Saldo Kas RT</p>
              <p className="mt-1 font-mono-num text-3xl sm:text-[2.5rem] font-extrabold tracking-tight leading-none tabular-nums">
                {formatRupiah(netBalance)}
              </p>
            </div>

            {/* SVG Circular Collection Progress Meter */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke="#6ee7b7"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute font-mono-num text-xs font-bold text-white tabular-nums">
                  {paymentProgressPct}%
                </span>
              </div>
              <span className="mt-1 text-[11px] font-medium text-emerald-200 whitespace-nowrap">
                Lunas Bulan Ini
              </span>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-200">
                <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Total Pemasukan</span>
              </div>
              <p className="mt-1 font-mono-num text-base sm:text-lg font-bold tabular-nums">
                {formatRupiah(totalIncome)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-200">
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>Total Pengeluaran</span>
              </div>
              <p className="mt-1 font-mono-num text-base sm:text-lg font-bold tabular-nums">
                {formatRupiah(totalExpense)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-emerald-200">Partisipasi {formatMonthLabel(currentMonth)}</p>
              <p className="mt-1 font-mono-num text-base sm:text-lg font-bold tabular-nums">
                {paidResidentsCount}/{totalResidentsCount} rumah
              </p>
            </div>
          </div>
        </section>

        {/* Resident Monthly Dues Reminder & Quick Action */}
        <section className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">
                Iuran {formatMonthLabel(currentMonth)}
              </span>
              <span className="font-medium">{myFamilyLabel}</span>
            </div>
            <h2 className="mt-1.5 text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {profile.displayName} 
            </h2>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{profile.houseBlock}</span>
            </div>

            {myDuesSummary.status === 'lunas' ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Iuran Bulan Ini Sudah Lunas
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                    Terverifikasi {formatRupiah(myDuesSummary.verifiedPaid)} dari tarif {formatRupiah(myDuesSummary.tariff)}
                    {myDuesSummary.carryOverFromPrev > 0
                      ? ` (termasuk saldo bulan lalu ${formatRupiah(myDuesSummary.carryOverFromPrev)})`
                      : ''}
                    .{' '}
                    {myDuesSummary.surplus > 0
                      ? `Kelebihan ${formatRupiah(myDuesSummary.surplus)} otomatis menjadi saldo bulan berikutnya.`
                      : 'Terima kasih atas partisipasi Anda.'}
                  </p>
                </div>
              </div>
            ) : myDuesSummary.status === 'kurang_bayar' ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-4">
                <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Status Pembayaran: Kurang Bayar
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    Tarif {formatRupiah(myDuesSummary.tariff)}
                    {myDuesSummary.carryOverFromPrev > 0
                      ? ` (terpotong saldo bulan lalu ${formatRupiah(myDuesSummary.carryOverFromPrev)})`
                      : ''}
                    . Sisa kekurangan sebesar{' '}
                    <strong className="font-mono-num">{formatRupiah(myDuesSummary.shortfall)}</strong>.
                  </p>
                </div>
              </div>
            ) : myDuesSummary.status === 'menunggu' ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-4">
                <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Menunggu Verifikasi Admin
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    Bukti pembayaran {formatRupiah(myDuesSummary.pendingPaid)} sedang diperiksa bendahara RT secara real-time.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Tagihan Bulan Ini
                  </p>
                  <span className="font-mono-num text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatRupiah(myDuesSummary.tariff)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Jatuh tempo setiap tanggal {rtSettings.dueDayOfMonth}. Transfer ke{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {rtSettings.bankName || 'Kas RT'} {rtSettings.bankAccountNumber || ''}
                  </span>
                </p>
                {rtSettings.bankAccountNumber && (
                  <button
                    type="button"
                    onClick={() => void handleCopyAccount()}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedBank ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>No. Rekening Disalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin No. Rekening RT</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onQuickPayDues}
              className="flex-1 min-h-[48px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer"
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>
                {myDuesSummary.status === 'kurang_bayar'
                  ? 'Lunasi Kekurangan'
                  : myDuesSummary.status === 'lunas' || myDuesSummary.status === 'menunggu'
                  ? 'Lihat Iuran Saya'
                  : 'Bayar Iuran'}
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenTutorial}
              className="min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Panduan</span>
            </button>
          </div>
        </section>
      </div>

      {/* Elderly-Friendly Quick Menu Grid */}
      <section aria-label="Menu Cepat Warga">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Menu Cepat Warga
          </h2>
          {isAdmin && pendingVerificationCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('kas')}
              className="min-h-[36px] px-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{pendingVerificationCount} bukti menunggu verifikasi</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onQuickPayDues}
            className="group min-h-[104px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 text-left hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Bayar Iuran</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Unggah foto bukti</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="group min-h-[104px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 text-left hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Laporan Kas</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rekap bulanan otomatis</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('darurat')}
            className="group min-h-[104px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 text-left hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Lapor Darurat SOS</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bantuan cepat</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('darurat')}
            className="group min-h-[104px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 text-left hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Profil Kesehatan</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Terenkripsi & siaga medis</p>
            </div>
          </button>
        </div>
      </section>

      {/* Two-Column Recent Activity & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Mutasi Kas Terbaru
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('kas')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline min-h-[36px] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTx.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Belum ada transaksi kas tercatat bulan ini.
                </p>
              </div>
            ) : (
              recentTx.map((tx) => {
                const isIncome = tx.type === 'income';
                const isMonthlyDues = isIncome && tx.category === 'iuran_bulanan';
                const txFamily = tx.familyStatus || residentMap.get(tx.residentUid)?.familyStatus || 'umum';
                const effectiveResident: ResidentPublic = residentMap.get(tx.residentUid) || {
                  uid: tx.residentUid,
                  displayName: tx.residentName,
                  houseBlock: tx.houseBlock,
                  residentStatus: 'tetap',
                  familyStatus: txFamily,
                  elderlyMode: false,
                  communityId: 'rt_warga',
                };
                const txLedger = isMonthlyDues
                  ? calculateResidentLedger(effectiveResident, transactions, tx.billingMonth)
                  : null;
                const isSettledMonth = Boolean(txLedger && txLedger.status === 'lunas');
                const underpaid =
                  isMonthlyDues &&
                  tx.status !== 'rejected' &&
                  !isSettledMonth &&
                  (txLedger?.status === 'kurang_bayar' || tx.status === 'kurang_bayar');
                return (
                  <div
                    key={tx.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {tx.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {tx.residentName} · {tx.houseBlock} · {CATEGORY_LABELS[tx.category]} ·{' '}
                          {tx.status === 'rejected'
                            ? 'Ditolak'
                            : tx.status === 'pending'
                            ? 'Menunggu'
                            : isMonthlyDues
                            ? isSettledMonth
                              ? 'Lunas'
                              : underpaid
                              ? 'Kurang Bayar'
                              : 'Terverifikasi'
                            : 'Terverifikasi'}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-mono-num text-sm font-bold tabular-nums shrink-0 ${
                        isIncome
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatRupiah(tx.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Pengumuman Lingkungan</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('pengumuman')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline min-h-[36px] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Semua Kabar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {latestAnnouncements.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada pengumuman terbaru dari pengurus RT.
              </p>
            ) : (
              latestAnnouncements.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate('pengumuman')}
                  className="w-full text-left px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={
                        item.priority === 'urgent'
                          ? 'font-bold text-red-600 dark:text-red-400'
                          : 'font-semibold text-emerald-700 dark:text-emerald-400'
                      }
                    >
                      {item.priority === 'urgent' ? 'Mendesak' : 'Info Warga'} · {item.category}
                    </span>
                    <span className="tabular-nums">{formatTimestamp(item.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
