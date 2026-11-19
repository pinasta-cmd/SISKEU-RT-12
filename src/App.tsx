import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { BellRing, BookOpen, RefreshCw, WifiOff, X } from 'lucide-react';
import { motion } from 'motion/react';
import { AnnouncementsView } from './components/AnnouncementsView';
import { CashflowAndDuesView } from './components/CashflowAndDuesView';
import { DashboardView } from './components/DashboardView';
import { EmergencyAndHealthView } from './components/EmergencyAndHealthView';
import { HeaderNav } from './components/HeaderNav';
import { LoginScreen } from './components/LoginScreen';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MonthlyReportView } from './components/MonthlyReportView';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { decryptSensitiveJson, encryptSensitiveJson } from './lib/crypto';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import {
  enqueueOfflineAction,
  getCachedBannerSlides,
  getOfflineQueue,
  removeOfflineAction,
  saveCachedBannerSlides,
  saveOfflineSnapshot,
} from './lib/offlineSync';
import type {
  Announcement,
  AnnouncementCategory,
  AppTab,
  BannerSlide,
  EmergencyAlert,
  EmergencyType,
  FamilyStatus,
  KasTransaction,
  PaymentMethod,
  PrivateHealthData,
  PrivateProfileData,
  ResidentPublic,
  ResidentStatus,
  RtSettings,
  TransactionCategory,
  UserNotification,
} from './types';
import {
  buildUpdatedFamilyStatusLog,
  calculateResidentLedger,
  formatMonthLabel,
  formatRupiah,
  getCurrentYearMonth,
  getEffectiveFamilyStatusChangeMonth,
  getRequiredTariff,
  getResidentFamilyStatusForMonth,
  sendBrowserPush,
} from './utils/format';

const DEFAULT_RT_SETTINGS: RtSettings = {
  rtName: 'RT 12',
  rwName: 'RW 20',
  kelurahan: 'Sukatani',
  monthlyDuesAmount: 120000,
  dueDayOfMonth: 10,
  bankName: 'Bank BJB',
  bankAccountNumber: '0139-2820-9410-0',
  bankAccountHolder: 'YEPIN ISKANDAR',
  emergencyPhoneRT: '112',
  emergencyPhoneMedical: '118',
  updatedBy: 'system',
};

const DEFAULT_PRIVATE_PROFILE: PrivateProfileData = {
  phone: '',
  nikMasked: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const DEFAULT_HEALTH_PROFILE: PrivateHealthData = {
  bloodType: 'Belum diketahui',
  allergies: '',
  chronicConditions: '',
  medications: '',
  insuranceProvider: '',
  shareInEmergency: true,
};

function sortByCreatedAtDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const getMs = (val: unknown): number => {
      if (!val) return Date.now();
      if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
        return (val as { toMillis: () => number }).toMillis();
      }
      if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
      return 0;
    };
    return getMs(b.createdAt) - getMs(a.createdAt);
  });
}

export default function App() {
  const isOnline = useOnlineStatus();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('kaswarga_dark_mode') === 'true';
  });
  const [elderlyMode, setElderlyMode] = useState<boolean>(() => {
    return localStorage.getItem('kaswarga_elderly_mode') === 'true';
  });

  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<ResidentPublic | null>(null);
  const [privateProfile, setPrivateProfile] = useState<PrivateProfileData>(DEFAULT_PRIVATE_PROFILE);
  const [healthProfile, setHealthProfile] = useState<PrivateHealthData>(DEFAULT_HEALTH_PROFILE);

  const [rtSettings, setRtSettings] = useState<RtSettings>(DEFAULT_RT_SETTINGS);
  const [transactions, setTransactions] = useState<KasTransaction[]>([]);
  const [residents, setResidents] = useState<ResidentPublic[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>(() => getCachedBannerSlides());

  const [activeTab, setActiveTab] = useState<AppTab>('beranda');
  const [openPaymentModalOnKas, setOpenPaymentModalOnKas] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [showNewUserBanner, setShowNewUserBanner] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveToast, setLiveToast] = useState<{ title: string; body: string; urgent?: boolean } | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => getOfflineQueue().length);

  const initialAnnouncementIdsRef = useRef<Set<string> | null>(null);
  const initialNotificationIdsRef = useRef<Set<string> | null>(null);
  const initialEmergencyIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('kaswarga_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('elderly-mode', elderlyMode);
    localStorage.setItem('kaswarga_elderly_mode', String(elderlyMode));
  }, [elderlyMode]);

  const showToast = useCallback((title: string, body: string, urgent = false) => {
    setLiveToast({ title, body, urgent });
    sendBrowserPush(title, body);
    window.setTimeout(() => {
      setLiveToast((prev) => (prev?.title === title && prev?.body === body ? null : prev));
    }, 6500);
  }, []);

  // Auth & Profile Bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        const isBootstrapped =
          ['pinasta@gmail.com', 'retakanbumi@gmail.com'].includes(user.email || '') &&
          user.emailVerified;
        let adminFlag = isBootstrapped;

        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) adminFlag = true;
        } catch {
          // Non-admin read may be denied or offline
        }
        setIsAdmin(adminFlag);

        // Bootstrap admin record and default settings if needed
        if (isBootstrapped) {
          try {
            const existingAdmin = await getDoc(doc(db, 'admins', user.uid));
            if (!existingAdmin.exists()) {
              await setDoc(doc(db, 'admins', user.uid), {
                uid: user.uid,
                email: user.email || 'retakanbumi@gmail.com',
                name: user.displayName || 'Pengurus RT',
                role: 'admin',
                createdAt: serverTimestamp(),
              });
            }
            const settingsSnap = await getDoc(doc(db, 'settings', 'rt_config'));
            if (!settingsSnap.exists()) {
              await setDoc(doc(db, 'settings', 'rt_config'), {
                ...DEFAULT_RT_SETTINGS,
                updatedBy: user.uid,
                updatedAt: serverTimestamp(),
              });
            }
          } catch {
            // Safe ignore if offline on bootstrap
          }
        }

        // Load or create resident directory profile
        const userRef = doc(db, 'users', user.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }

        if (userSnap && userSnap.exists()) {
          const data = userSnap.data() as ResidentPublic;
          setProfile(data);
          if (typeof data.elderlyMode === 'boolean') {
            setElderlyMode(data.elderlyMode);
          }
        } else {
          const initialProfile: ResidentPublic = {
            uid: user.uid,
            displayName: user.displayName || 'Warga RT',
            houseBlock: 'Blok A-01',
            residentStatus: adminFlag ? 'pengurus' : 'tetap',
            familyStatus: 'umum',
            familyStatusLog: [`${getCurrentYearMonth()}:umum`],
            elderlyMode: false,
            communityId: 'rt_warga',
          };
          try {
            await setDoc(userRef, {
              ...initialProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
          }
          setProfile(initialProfile);
          if (!localStorage.getItem(`kaswarga_seen_intro_${user.uid}`)) {
            setShowNewUserBanner(true);
          }
        }

        // Load & decrypt isolated PII & Health Profile
        try {
          const privProfSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'profile'));
          if (privProfSnap.exists()) {
            const decrypted = await decryptSensitiveJson<PrivateProfileData>(
              user.uid,
              privProfSnap.data().encryptedPayload as string
            );
            if (decrypted) setPrivateProfile(decrypted);
          }
          const privHealthSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'health'));
          if (privHealthSnap.exists()) {
            const decrypted = await decryptSensitiveJson<PrivateHealthData>(
              user.uid,
              privHealthSnap.data().encryptedPayload as string
            );
            if (decrypted) setHealthProfile(decrypted);
          }
        } catch {
          // Offline or not yet created
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Public Community Slideshow Listener (active on LoginScreen & Settings)
  useEffect(() => {
    const unsubSlides = onSnapshot(
      query(collection(db, 'slides'), where('communityId', '==', 'rt_warga')),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BannerSlide))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setBannerSlides(list);
        saveCachedBannerSlides(list);
      },
      () => {
        // Keep cached slides silently if offline or network interrupted
      }
    );

    return () => unsubSlides();
  }, []);

  // Real-Time Firestore Listeners
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'rt_config'),
      (snap) => {
        if (snap.exists()) {
          setRtSettings(snap.data() as RtSettings);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/rt_config')
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('communityId', '==', 'rt_warga')),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ResidentPublic);
        setResidents(list.sort((a, b) => a.houseBlock.localeCompare(b.houseBlock)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), where('communityId', '==', 'rt_warga')),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as KasTransaction)
        );
        setTransactions(sortByCreatedAtDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubAnnouncements = onSnapshot(
      query(collection(db, 'announcements'), where('communityId', '==', 'rt_warga')),
      (snap) => {
        const list = sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))
        );
        if (initialAnnouncementIdsRef.current === null) {
          initialAnnouncementIdsRef.current = new Set(list.map((a) => a.id));
        } else {
          const newest = list.find((a) => !initialAnnouncementIdsRef.current?.has(a.id));
          if (newest) {
            initialAnnouncementIdsRef.current.add(newest.id);
            showToast(
              `Pengumuman RT: ${newest.title}`,
              newest.body.slice(0, 120),
              newest.priority === 'urgent'
            );
          }
        }
        setAnnouncements(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    const unsubEmergencies = onSnapshot(
      query(collection(db, 'emergencies'), where('communityId', '==', 'rt_warga')),
      (snap) => {
        const list = sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmergencyAlert))
        );
        if (initialEmergencyIdsRef.current === null) {
          initialEmergencyIdsRef.current = new Set(list.map((e) => e.id));
        } else {
          const newest = list.find(
            (e) => e.status === 'active' && !initialEmergencyIdsRef.current?.has(e.id)
          );
          if (newest) {
            initialEmergencyIdsRef.current.add(newest.id);
            showToast(
              `DARURAT ${newest.emergencyType.toUpperCase()}: ${newest.houseBlock}`,
              `${newest.reporterName}: ${newest.description || 'Butuh bantuan segera!'}`,
              true
            );
          }
        }
        setEmergencies(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'emergencies')
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('targetUid', '==', currentUser.uid)),
      (snap) => {
        const list = sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserNotification))
        );
        if (initialNotificationIdsRef.current === null) {
          initialNotificationIdsRef.current = new Set(list.map((n) => n.id));
        } else {
          const newest = list.find((n) => !n.isRead && !initialNotificationIdsRef.current?.has(n.id));
          if (newest) {
            initialNotificationIdsRef.current.add(newest.id);
            showToast(newest.title, newest.message, newest.type === 'emergency');
          }
        }
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubSettings();
      unsubUsers();
      unsubTransactions();
      unsubAnnouncements();
      unsubEmergencies();
      unsubNotifications();
    };
  }, [authReady, currentUser, showToast]);

  // Keep offline emergency snapshot up-to-date
  useEffect(() => {
    if (!profile) return;
    const summaryParts = [
      healthProfile.bloodType && healthProfile.bloodType !== 'Belum diketahui'
        ? `Gol. Darah ${healthProfile.bloodType}`
        : '',
      healthProfile.allergies ? `Alergi: ${healthProfile.allergies}` : '',
      healthProfile.chronicConditions ? `Riwayat: ${healthProfile.chronicConditions}` : '',
      healthProfile.medications ? `Obat: ${healthProfile.medications}` : '',
    ].filter(Boolean);

    saveOfflineSnapshot({
      updatedAtIso: new Date().toISOString(),
      residentName: profile.displayName,
      houseBlock: profile.houseBlock,
      medicalSummary: summaryParts.join(' · '),
      emergencyContact:
        privateProfile.emergencyContactName && privateProfile.emergencyContactPhone
          ? `${privateProfile.emergencyContactName} (${privateProfile.emergencyContactPhone})`
          : '',
      rtSettings,
      recentTransactions: transactions.slice(0, 10),
      activeEmergencies: emergencies.filter((e) => e.status !== 'resolved'),
    });
  }, [profile, healthProfile, privateProfile, rtSettings, transactions, emergencies]);

  // Auto-sync offline queue when connectivity restores
  const flushOfflineQueue = useCallback(async () => {
    if (!isOnline || !currentUser || !profile) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    let syncedCount = 0;
    for (const item of queue) {
      try {
        if (item.kind === 'dues_submission') {
          await addDoc(collection(db, 'transactions'), {
            ...item.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          removeOfflineAction(item.localId);
          syncedCount++;
        } else if (item.kind === 'emergency_alert') {
          await addDoc(collection(db, 'emergencies'), {
            ...item.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          removeOfflineAction(item.localId);
          syncedCount++;
        }
      } catch {
        // Leave in queue if sync failed
      }
    }
    setOfflineQueueCount(getOfflineQueue().length);
    if (syncedCount > 0) {
      showToast(
        'Sinkronisasi Otomatis Berhasil',
        `${syncedCount} data dari mode offline telah tersinkron ke cloud.`
      );
    }
  }, [isOnline, currentUser, profile, showToast]);

  useEffect(() => {
    void flushOfflineQueue();
  }, [flushOfflineQueue]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const rawMessage = err instanceof Error ? err.message : '';
      if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setLoginError(
          `Domain "${host}" belum terdaftar di Authorized Domains Firebase Authentication. Jika membuka dari URL baru/eksternal, tambahkan "${host}" di Firebase Console (Authentication → Settings → Authorized domains), atau muat ulang halaman jika baru saja diperbarui.`
        );
      } else if (code === 'auth/popup-blocked') {
        setLoginError(
          'Pop-up login Google diblokir oleh browser. Mohon izinkan pop-up untuk situs ini lalu coba lagi.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setLoginError(
          'Jendela login Google ditutup sebelum proses masuk selesai. Silakan klik Masuk kembali.'
        );
      } else {
        setLoginError(
          err instanceof Error
            ? `Gagal masuk: ${err.message}`
            : 'Gagal masuk dengan Google. Pastikan pop-up diizinkan.'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setSettingsOpen(false);
    await signOut(auth);
  };

  const handleToggleElderlyMode = async () => {
    const next = !elderlyMode;
    setElderlyMode(next);
    if (currentUser && profile) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          elderlyMode: next,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Still persisted locally
      }
    }
  };

  const handleSubmitDues = async (data: {
    title: string;
    amount: number;
    billingMonth: string;
    paymentMethod: PaymentMethod;
    proofImageData: string;
    notes: string;
  }) => {
    if (!currentUser || !profile) return;

    const payload = {
      type: 'income' as const,
      category: 'iuran_bulanan' as const,
      title: data.title.slice(0, 120),
      amount: data.amount,
      billingMonth: data.billingMonth,
      residentUid: currentUser.uid,
      residentName: profile.displayName.slice(0, 80),
      houseBlock: profile.houseBlock.slice(0, 30),
      familyStatus: getResidentFamilyStatusForMonth(profile, data.billingMonth, transactions),
      paymentMethod: data.paymentMethod,
      proofImageData: data.proofImageData || '',
      status: 'pending' as const,
      verifiedBy: '',
      rejectionReason: '',
      notes: data.notes.slice(0, 300),
      communityId: 'rt_warga',
    };

    if (!isOnline) {
      enqueueOfflineAction({ kind: 'dues_submission', payload });
      setOfflineQueueCount(getOfflineQueue().length);
      return;
    }

    try {
      await addDoc(collection(db, 'transactions'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    }
  };

  const handleAdminCreateTransaction = async (data: {
    type: 'income' | 'expense';
    category: TransactionCategory;
    title: string;
    amount: number;
    billingMonth: string;
    paymentMethod: PaymentMethod;
    notes: string;
  }) => {
    if (!currentUser || !profile) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        type: data.type,
        category: data.category,
        title: data.title.slice(0, 120),
        amount: data.amount,
        billingMonth: data.billingMonth,
        residentUid: currentUser.uid,
        residentName: profile.displayName.slice(0, 80),
        houseBlock: profile.houseBlock.slice(0, 30),
        paymentMethod: data.paymentMethod,
        proofImageData: '',
        status: 'approved',
        verifiedBy: currentUser.uid,
        rejectionReason: '',
        notes: data.notes.slice(0, 300),
        communityId: 'rt_warga',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    }
  };

  const handleAdminVerifyTransaction = async (
    tx: KasTransaction,
    decision: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    if (!currentUser) return;
    const resident = residents.find((r) => r.uid === tx.residentUid);
    const familyStatus = tx.familyStatus || resident?.familyStatus || 'umum';
    const effectiveResident: ResidentPublic = resident || {
      uid: tx.residentUid,
      displayName: tx.residentName,
      houseBlock: tx.houseBlock,
      residentStatus: 'tetap',
      familyStatus,
      elderlyMode: false,
      communityId: 'rt_warga',
    };

    const simulatedTxs = transactions.map((t) =>
      t.id === tx.id ? { ...t, status: decision } : t
    );
    const ledgerAfter = calculateResidentLedger(
      effectiveResident,
      simulatedTxs,
      tx.billingMonth
    );

    const isUnderpaid =
      decision === 'approved' &&
      tx.category === 'iuran_bulanan' &&
      ledgerAfter.status === 'kurang_bayar';
    const finalStatus =
      decision === 'rejected' ? 'rejected' : isUnderpaid ? 'kurang_bayar' : 'approved';

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', tx.id), {
        status: finalStatus,
        rejectionReason: decision === 'rejected' ? (rejectionReason || '').slice(0, 200) : '',
        verifiedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });

      // Jika pembayaran ini melunasi bulan tagihan, ubah transaksi kurang_bayar sebelumnya menjadi approved (Lunas)
      if (decision === 'approved' && tx.category === 'iuran_bulanan' && !isUnderpaid) {
        const priorUnderpaid = transactions.filter(
          (t) =>
            t.id !== tx.id &&
            t.residentUid === tx.residentUid &&
            t.type === 'income' &&
            t.category === 'iuran_bulanan' &&
            t.billingMonth === tx.billingMonth &&
            t.status === 'kurang_bayar'
        );
        for (const prevTx of priorUnderpaid) {
          batch.update(doc(db, 'transactions', prevTx.id), {
            status: 'approved',
            verifiedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      if (decision === 'approved' && tx.category === 'iuran_bulanan' && !isUnderpaid) {
        try {
          await updateDoc(doc(db, 'users', tx.residentUid), {
            lastPaidMonth: tx.billingMonth,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore if resident doc missing
        }
      }

      const shortfall = ledgerAfter.shortfall;
      const surplus = ledgerAfter.surplus;
      await addDoc(collection(db, 'notifications'), {
        targetUid: tx.residentUid,
        senderUid: currentUser.uid,
        title:
          decision === 'rejected'
            ? `Bukti Iuran ${formatMonthLabel(tx.billingMonth)} Ditolak`
            : isUnderpaid
            ? `Iuran ${formatMonthLabel(tx.billingMonth)} Kurang Bayar`
            : `Iuran ${formatMonthLabel(tx.billingMonth)} Lunas & Disetujui`,
        message:
          decision === 'rejected'
            ? `Alasan: ${rejectionReason || 'Mohon unggah ulang foto bukti yang jelas.'}`
            : isUnderpaid
            ? `Pembayaran ${formatRupiah(tx.amount)} diterima, namun masih kurang ${formatRupiah(
                shortfall
              )} dari tarif ${formatRupiah(ledgerAfter.requiredTariff)}.`
            : surplus > 0
            ? `Pembayaran ${formatRupiah(tx.amount)} disetujui. Iuran ${formatMonthLabel(
                tx.billingMonth
              )} LUNAS dan kelebihan ${formatRupiah(surplus)} otomatis menjadi saldo bulan berikutnya.`
            : `Pembayaran ${formatRupiah(tx.amount)} telah diverifikasi oleh bendahara RT. Status iuran kini LUNAS.`,
        type: decision === 'approved' ? 'payment_approved' : 'payment_rejected',
        isRead: false,
        relatedId: tx.id,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const handleSendPaymentReminders = async (
    unpaidResidents: ResidentPublic[],
    yearMonth: string
  ): Promise<number> => {
    if (!currentUser) return 0;
    try {
      const batch = writeBatch(db);
      for (const res of unpaidResidents) {
        const resTariff = getRequiredTariff(
          getResidentFamilyStatusForMonth(res, yearMonth, transactions)
        );
        const ref = doc(collection(db, 'notifications'));
        batch.set(ref, {
          targetUid: res.uid,
          senderUid: currentUser.uid,
          title: `Pengingat Iuran ${formatMonthLabel(yearMonth)}`,
          message: `Yth. ${res.displayName} (${res.houseBlock}), iuran kas RT sebesar ${formatRupiah(
            resTariff
          )} jatuh tempo tanggal ${rtSettings.dueDayOfMonth}.`,
          type: 'payment_reminder',
          isRead: false,
          relatedId: yearMonth,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return unpaidResidents.length;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  const handlePublishAnnouncement = async (data: {
    title: string;
    body: string;
    category: AnnouncementCategory;
    priority: 'normal' | 'urgent';
  }) => {
    if (!currentUser || !profile) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        title: data.title.slice(0, 120),
        body: data.body.slice(0, 1000),
        category: data.category,
        priority: data.priority,
        authorUid: currentUser.uid,
        authorName: profile.displayName.slice(0, 80),
        communityId: 'rt_warga',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'announcements');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const handleTriggerSOS = async (payload: {
    emergencyType: EmergencyType;
    description: string;
    locationText: string;
  }) => {
    if (!currentUser || !profile) return;

    const medicalSummaryParts = healthProfile.shareInEmergency
      ? [
          healthProfile.bloodType && healthProfile.bloodType !== 'Belum diketahui'
            ? `Gol. Darah: ${healthProfile.bloodType}`
            : '',
          healthProfile.allergies ? `Alergi: ${healthProfile.allergies}` : '',
          healthProfile.chronicConditions ? `Kondisi: ${healthProfile.chronicConditions}` : '',
          healthProfile.medications ? `Obat: ${healthProfile.medications}` : '',
          healthProfile.insuranceProvider ? `Faskes: ${healthProfile.insuranceProvider}` : '',
        ].filter(Boolean)
      : [];

    const emergencyContact =
      privateProfile.emergencyContactName && privateProfile.emergencyContactPhone
        ? `${privateProfile.emergencyContactName} (${privateProfile.emergencyContactPhone})`
        : privateProfile.phone || '';

    const docPayload = {
      reporterUid: currentUser.uid,
      reporterName: profile.displayName.slice(0, 80),
      houseBlock: profile.houseBlock.slice(0, 30),
      emergencyType: payload.emergencyType,
      description: payload.description.slice(0, 400),
      locationText: payload.locationText.slice(0, 160),
      medicalSummary: medicalSummaryParts.join(' · ').slice(0, 400),
      emergencyContact: emergencyContact.slice(0, 120),
      status: 'active' as const,
      responderName: '',
      communityId: 'rt_warga',
    };

    if (!isOnline) {
      enqueueOfflineAction({ kind: 'emergency_alert', payload: docPayload });
      setOfflineQueueCount(getOfflineQueue().length);
      return;
    }

    try {
      await addDoc(collection(db, 'emergencies'), {
        ...docPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'emergencies');
    }
  };

  const handleUpdateEmergencyStatus = async (
    alert: EmergencyAlert,
    status: 'responding' | 'resolved'
  ) => {
    if (!currentUser || !profile) return;
    try {
      const updates: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (isAdmin && status === 'responding') {
        updates.responderName = profile.displayName.slice(0, 80);
      }
      await updateDoc(doc(db, 'emergencies', alert.id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `emergencies/${alert.id}`);
    }
  };

  const handleSaveEncryptedHealthAndProfile = async (
    nextProfile: PrivateProfileData,
    nextHealth: PrivateHealthData
  ) => {
    if (!currentUser) return;
    setPrivateProfile(nextProfile);
    setHealthProfile(nextHealth);

    const encProfile = await encryptSensitiveJson(currentUser.uid, nextProfile);
    const encHealth = await encryptSensitiveJson(currentUser.uid, nextHealth);

    const summary = [
      nextHealth.bloodType && nextHealth.bloodType !== 'Belum diketahui'
        ? `Gol. Darah: ${nextHealth.bloodType}`
        : '',
      nextHealth.allergies ? `Alergi: ${nextHealth.allergies}` : '',
      nextHealth.chronicConditions ? `Kondisi: ${nextHealth.chronicConditions}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 400);

    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'private', 'profile'), {
        uid: currentUser.uid,
        docType: 'profile',
        encryptedPayload: encProfile,
        encryptionAlg: 'AES-GCM-256',
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', currentUser.uid, 'private', 'health'), {
        uid: currentUser.uid,
        docType: 'health',
        encryptedPayload: encHealth,
        encryptionAlg: 'AES-GCM-256',
        shareInEmergency: nextHealth.shareInEmergency,
        emergencySummary: summary,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/private`);
    }
  };

  const handleSaveProfile = async (data: {
    displayName: string;
    houseBlock: string;
    residentStatus: ResidentStatus;
    familyStatus: FamilyStatus;
  }) => {
    if (!currentUser) return;
    const prevFamilyStatus: FamilyStatus = profile?.familyStatus || 'umum';
    const hasFamilyStatusChanged = data.familyStatus !== prevFamilyStatus;
    let nextFamilyStatusLog: string[] | undefined;

    if (hasFamilyStatusChanged && profile) {
      const effectiveMonth = getEffectiveFamilyStatusChangeMonth(
        transactions,
        currentUser.uid
      );
      nextFamilyStatusLog = buildUpdatedFamilyStatusLog(
        profile,
        data.familyStatus,
        effectiveMonth
      );
    }

    const updates: Record<string, unknown> = {
      displayName: data.displayName.slice(0, 80),
      houseBlock: data.houseBlock.slice(0, 30),
      residentStatus: data.residentStatus,
      familyStatus: data.familyStatus,
      updatedAt: serverTimestamp(),
    };
    if (nextFamilyStatusLog) {
      updates.familyStatusLog = nextFamilyStatusLog;
    }

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), updates);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...data,
              ...(nextFamilyStatusLog ? { familyStatusLog: nextFamilyStatusLog } : {}),
            }
          : prev
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const handleSaveRtSettings = async (data: Omit<RtSettings, 'updatedBy' | 'updatedAt'>) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'settings', 'rt_config'), {
        ...data,
        updatedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      setRtSettings({ ...data, updatedBy: currentUser.uid });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/rt_config');
    }
  };

  const handleAddBannerSlide = async (data: {
    title: string;
    subtitle: string;
    imageData: string;
  }) => {
    if (!currentUser) return;
    const nextSortOrder =
      bannerSlides.length > 0
        ? Math.min(
            1000,
            Math.max(...bannerSlides.map((s) => Math.round(Number(s.sortOrder) || 0))) + 1
          )
        : 0;
    try {
      await addDoc(collection(db, 'slides'), {
        title: data.title.trim().slice(0, 80),
        subtitle: data.subtitle.trim().slice(0, 160),
        imageData: data.imageData,
        sortOrder: nextSortOrder,
        uploadedBy: currentUser.uid,
        communityId: 'rt_warga',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'slides');
    }
  };

  const handleUpdateBannerSlide = async (
    id: string,
    data: { title: string; subtitle: string }
  ) => {
    try {
      await updateDoc(doc(db, 'slides', id), {
        title: data.title.trim().slice(0, 80),
        subtitle: data.subtitle.trim().slice(0, 160),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `slides/${id}`);
    }
  };

  const handleMoveBannerSlide = async (id: string, direction: 'up' | 'down') => {
    const idx = bannerSlides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= bannerSlides.length) return;

    const reordered = [...bannerSlides];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    try {
      const batch = writeBatch(db);
      reordered.forEach((slide, orderIdx) => {
        batch.update(doc(db, 'slides', slide.id), {
          sortOrder: orderIdx,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'slides');
    }
  };

  const handleDeleteBannerSlide = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'slides', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `slides/${id}`);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const n of unread) {
        batch.update(doc(db, 'notifications', n.id), { isRead: true });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 p-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-display font-extrabold text-base">
            RT
          </div>
          <p className="font-display text-lg font-extrabold text-slate-900 dark:text-slate-100">
            SISKEU RT12/RW20 SUKATANI
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Menyiapkan data warga...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !profile) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        loginError={loginError}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        elderlyMode={elderlyMode}
        onToggleElderlyMode={() => setElderlyMode((e) => !e)}
        isOnline={isOnline}
        bannerSlides={bannerSlides}
      />
    );
  }

  // Merge offline queued items for transparent immediate visibility
  const offlineItems = getOfflineQueue();
  const mergedTransactions: KasTransaction[] = [
    ...offlineItems
      .filter((q) => q.kind === 'dues_submission')
      .map((q) => ({
        id: q.localId,
        ...(q.payload as Omit<KasTransaction, 'id'>),
        createdAt: q.createdAtIso,
        isOfflinePending: true,
      })),
    ...transactions,
  ];
  const mergedEmergencies: EmergencyAlert[] = [
    ...offlineItems
      .filter((q) => q.kind === 'emergency_alert')
      .map((q) => ({
        id: q.localId,
        ...(q.payload as Omit<EmergencyAlert, 'id'>),
        createdAt: q.createdAtIso,
        isOfflinePending: true,
      })),
    ...emergencies,
  ];

  const activeEmergencyCount = mergedEmergencies.filter((e) => e.status !== 'resolved').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-12">
      <HeaderNav
        activeTab={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setOpenPaymentModalOnKas(false);
        }}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllRead}
        onOpenSettings={() => setSettingsOpen(true)}
        activeEmergencyCount={activeEmergencyCount}
      />

      {/* Non-intrusive Real-Time Toast Banner */}
      {liveToast && (
        <div
          role="status"
          className={`fixed top-16 right-4 z-50 max-w-sm w-[calc(100%-2rem)] rounded-2xl p-4 shadow-xl border flex items-start gap-3 ${
            liveToast.urgent
              ? 'bg-red-600 text-white border-red-500'
              : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
          }`}
        >
          <BellRing className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{liveToast.title}</p>
            <p className="text-xs opacity-90 mt-0.5 line-clamp-2">{liveToast.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            aria-label="Tutup pemberitahuan"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Offline / Pending Sync Notice */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 print:hidden">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                {!isOnline
                  ? 'Mode Offline Aktif — Data kas & profil darurat tetap dapat diakses. Perubahan akan disinkronkan otomatis saat online.'
                  : `${offlineQueueCount} data offline siap disinkronkan ke cloud.`}
              </span>
            </div>
            {isOnline && offlineQueueCount > 0 && (
              <button
                type="button"
                onClick={() => void flushOfflineQueue()}
                className="min-h-[36px] px-3 rounded-lg bg-amber-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sinkronkan</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Non-blocking New User Interactive Tutorial Banner */}
      {showNewUserBanner && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 print:hidden">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Selamat datang di KasWarga RT! Baru pertama kali menggunakan aplikasi?
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Ikuti panduan interaktif 1 menit untuk mengenal cara bayar iuran, cek laporan, dan tombol darurat SOS.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(`kaswarga_seen_intro_${currentUser.uid}`, '1');
                  setShowNewUserBanner(false);
                  setTutorialOpen(true);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap"
              >
                Mulai Panduan
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(`kaswarga_seen_intro_${currentUser.uid}`, '1');
                  setShowNewUserBanner(false);
                }}
                className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'beranda' && (
            <DashboardView
              profile={profile}
              isAdmin={isAdmin}
              rtSettings={rtSettings}
              transactions={mergedTransactions}
              residents={residents}
              announcements={announcements}
              emergencies={mergedEmergencies}
              onNavigate={setActiveTab}
              onOpenTutorial={() => setTutorialOpen(true)}
              onQuickPayDues={() => {
                setOpenPaymentModalOnKas(true);
                setActiveTab('kas');
              }}
            />
          )}

          {activeTab === 'kas' && (
            <CashflowAndDuesView
              profile={profile}
              residents={residents}
              isAdmin={isAdmin}
              isOnline={isOnline}
              rtSettings={rtSettings}
              transactions={mergedTransactions}
              openPaymentModalInitially={openPaymentModalOnKas}
              onCloseInitialPaymentModal={() => setOpenPaymentModalOnKas(false)}
              onSubmitDues={handleSubmitDues}
              onAdminCreateTransaction={handleAdminCreateTransaction}
              onAdminVerifyTransaction={handleAdminVerifyTransaction}
            />
          )}

          {activeTab === 'laporan' && (
            <MonthlyReportView
              isAdmin={isAdmin}
              rtSettings={rtSettings}
              transactions={mergedTransactions}
              residents={residents}
              onSendPaymentReminders={handleSendPaymentReminders}
            />
          )}

          {activeTab === 'pengumuman' && (
            <AnnouncementsView
              isAdmin={isAdmin}
              announcements={announcements}
              onPublishAnnouncement={handlePublishAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
            />
          )}

          {activeTab === 'darurat' && (
            <EmergencyAndHealthView
              profile={profile}
              isAdmin={isAdmin}
              isOnline={isOnline}
              rtSettings={rtSettings}
              emergencies={mergedEmergencies}
              privateProfile={privateProfile}
              healthProfile={healthProfile}
              onTriggerSOS={handleTriggerSOS}
              onUpdateEmergencyStatus={handleUpdateEmergencyStatus}
              onSaveEncryptedHealthAndProfile={handleSaveEncryptedHealthAndProfile}
            />
          )}
        </motion.div>
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setOpenPaymentModalOnKas(false);
        }}
        activeEmergencyCount={activeEmergencyCount}
      />

      <OnboardingTutorial
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onNavigate={setActiveTab}
      />

      <ProfileSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        userEmail={currentUser.email || ''}
        isAdmin={isAdmin}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        elderlyMode={elderlyMode}
        onToggleElderlyMode={() => void handleToggleElderlyMode()}
        rtSettings={rtSettings}
        transactions={mergedTransactions}
        bannerSlides={bannerSlides}
        onSaveProfile={handleSaveProfile}
        onSaveRtSettings={handleSaveRtSettings}
        onAddBannerSlide={handleAddBannerSlide}
        onUpdateBannerSlide={handleUpdateBannerSlide}
        onMoveBannerSlide={handleMoveBannerSlide}
        onDeleteBannerSlide={handleDeleteBannerSlide}
        onOpenTutorial={() => setTutorialOpen(true)}
        onLogout={handleLogout}
      />
    </div>
  );
}
