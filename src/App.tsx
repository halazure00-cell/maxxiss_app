/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { Joyride, type EventData, STATUS, EVENTS, ACTIONS, type Step } from 'react-joyride';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Finance from './components/Finance';
import Radar from './components/Radar';
import Advice from './components/Advice';
import Analytics from './components/Analytics';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import { getCurrentUser, login, logout, type AuthUser } from './lib/auth';
import { bootstrapCurrentUser, importLegacySnapshot } from './lib/sync';
import { clearLocalCache, getLegacySnapshot, hasCompletedLegacyMigration, markLegacyMigrationCompleted } from './lib/db';

const TOUR_STEPS: Step[] = [
  {
    target: '.tour-header',
    content: 'Selamat datang di MAXXISS! Aplikasi asisten harian untuk memaksimalkan cuan Anda. Mari kita mulai tur singkat ini.',
    skipBeacon: true,
  },
  {
    target: '.tour-radar-tab',
    content: 'Ini adalah tab Radar. Tempat utama Anda untuk mencatat setiap orderan yang masuk dengan cepat.',
  },
  {
    target: '.tour-logger-btn',
    content: 'Tahan tombol ini selama 1 detik untuk mencatat orderan. Sistem akan otomatis mencatat lokasi, cuaca, dan menghitung potongan komisi.',
  },
  {
    target: '.tour-finance-tab',
    content: 'Di tab Keuangan, Anda bisa memantau seluruh pemasukan, pengeluaran, dan saldo virtual Anda.',
  },
  {
    target: '.tour-virtual-wallet',
    content: 'Catat top-up saldo Maxim Anda di sini agar sinkron dengan pengeluaran harian.',
  },
  {
    target: '.tour-roi-panel',
    content: 'Pantau Hasil Bersih (Surplus/Tekor) hari ini. Anda juga bisa membagikan struk rekap harian ke grup atau menyimpannya.',
  },
  {
    target: '.tour-analytics-tab',
    content: 'Tab Analitik memberikan wawasan mendalam tentang performa Anda dari waktu ke waktu.',
  },
  {
    target: '.tour-advice-tab',
    content: 'Tab Saran memberikan rekomendasi spot gacor dan analisa performa harian Anda.',
  },
];

const ADMIN_PATH = '/internal/maxxiss-admin';

export default function App() {
  const [activeTab, setActiveTab] = useState('radar');
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const isAdminRoute = currentPath === ADMIN_PATH;

  const bootstrapUserState = async (user: AuthUser) => {
    const shouldCheckLegacy = !(await hasCompletedLegacyMigration(user.id));
    const legacySnapshot = shouldCheckLegacy ? await getLegacySnapshot() : null;
    const hasLegacyData = !!legacySnapshot && (legacySnapshot.transactions.length > 0 || legacySnapshot.radarLogs.length > 0);

    let bootstrapPayload = await bootstrapCurrentUser();

    if (legacySnapshot && hasLegacyData && bootstrapPayload && !bootstrapPayload.hasServerData) {
      const shouldImport = window.confirm('Data lokal lama terdeteksi di browser ini. Import data tersebut ke akun cloud ini sekarang?');
      if (shouldImport) {
        await importLegacySnapshot(legacySnapshot);
        bootstrapPayload = await bootstrapCurrentUser();
      }
      await markLegacyMigrationCompleted(user.id);
    }

    return bootstrapPayload;
  };

  useEffect(() => {
    const handlePathChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePathChange);

    const loadSession = async () => {
      setIsCheckingSession(true);
      setSessionError(null);

      try {
        const user = await getCurrentUser();
        if (!user) {
          await clearLocalCache();
          setCurrentUser(null);
          return;
        }

        await bootstrapUserState(user);
        setCurrentUser(user);
      } catch (error: any) {
        console.error(error);
        setSessionError(error?.message || 'Gagal memuat sesi aplikasi.');
        setCurrentUser(null);
      } finally {
        setIsCheckingSession(false);
      }
    };

    loadSession();

    return () => {
      window.removeEventListener('popstate', handlePathChange);
    };
  }, []);

  const replacePath = (path: string) => {
    window.history.replaceState({}, '', path);
    setCurrentPath(path);
  };

  const handleLogin = async (username: string, password: string) => {
    const user = await login(username, password);
    await bootstrapUserState(user);
    setCurrentUser(user);
    setSessionError(null);
  };

  const handleLogout = async () => {
    await logout();
    await clearLocalCache();
    setCurrentUser(null);
    setRunTour(false);
    if (currentPath === ADMIN_PATH) {
      replacePath('/');
    }
  };

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);

      if (nextStepIndex === 1 || nextStepIndex === 2) {
        setActiveTab('radar');
      } else if (nextStepIndex === 3 || nextStepIndex === 4 || nextStepIndex === 5) {
        setActiveTab('finance');
      } else if (nextStepIndex === 6) {
        setActiveTab('analytics');
      } else if (nextStepIndex === 7) {
        setActiveTab('advice');
      }

      setTimeout(() => {
        setStepIndex(nextStepIndex);
      }, 100);
    }
  };

  const startTour = () => {
    setActiveTab('radar');
    setStepIndex(0);
    setRunTour(true);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-[100dvh] bg-[#F8F9FA] text-[#474B51] flex items-center justify-center">
        <div className="flex items-center gap-3 font-black uppercase tracking-[0.2em]">
          <Loader2 size={20} className="animate-spin text-[#4A5D5A]" />
          <span>Memuat Sesi</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen onSubmit={handleLogin} />
        {sessionError ? (
          <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-md rounded-2xl bg-red-50 text-red-600 px-4 py-3 text-sm font-bold">
            {sessionError}
          </div>
        ) : null}
        <Toaster position="top-center" richColors />
      </>
    );
  }

  if (isAdminRoute) {
    if (currentUser.role !== 'ADMIN') {
      return (
        <div className="min-h-[100dvh] bg-[#F8F9FA] text-[#474B51] flex items-center justify-center p-5">
          <div className="max-w-md w-full bg-white rounded-[28px] border border-[#4A5D5A]/10 shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4">
              <ShieldAlert size={28} />
            </div>
            <h1 className="text-2xl font-black text-[#4A5D5A]">Akses Ditolak</h1>
            <p className="text-sm text-[#474B51]/70 mt-3 leading-relaxed">
              Route internal ini hanya bisa diakses oleh akun developer/admin.
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <button
                onClick={() => replacePath('/')}
                className="px-4 py-3 rounded-2xl bg-[#4A5D5A]/10 text-[#4A5D5A] text-sm font-black uppercase tracking-wider"
              >
                Kembali
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-3 rounded-2xl bg-[#F8CB1D] text-[#4A5D5A] text-sm font-black uppercase tracking-wider"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <AdminPanel
          currentUser={currentUser}
          onBack={() => replacePath('/')}
          onLogout={handleLogout}
        />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <>
      <Joyride
        steps={TOUR_STEPS}
        run={runTour}
        stepIndex={stepIndex}
        onEvent={handleJoyrideCallback}
        continuous
        options={{
          primaryColor: '#F8CB1D',
          textColor: '#474B51',
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 10000,
          showProgress: true,
          buttons: ['back', 'close', 'primary', 'skip'],
        }}
        styles={{
          buttonPrimary: {
            backgroundColor: '#4A5D5A',
            color: '#F8CB1D',
            fontWeight: 'bold',
            borderRadius: '8px',
          },
          buttonBack: {
            color: '#474B51',
          },
          buttonSkip: {
            color: '#474B51',
          },
        }}
        locale={{
          back: 'Kembali',
          close: 'Tutup',
          last: 'Selesai',
          next: 'Lanjut',
          skip: 'Lewati',
        }}
      />
      <Layout
        user={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStartTour={startTour}
        onLogout={handleLogout}
      >
        {activeTab === 'radar' && <Radar />}
        {activeTab === 'finance' && <Finance />}
        {activeTab === 'advice' && <Advice />}
        {activeTab === 'analytics' && <Analytics />}
      </Layout>
      <Toaster position="top-center" richColors />
    </>
  );
}
