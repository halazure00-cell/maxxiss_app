/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState } from 'react';
import { Joyride, EventData, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Finance from './components/Finance';
import Radar from './components/Radar';
import Advice from './components/Advice';
import Analytics from './components/Analytics';

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
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('radar');
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      
      // Switch tabs based on the next step to ensure targets are mounted
      if (nextStepIndex === 1 || nextStepIndex === 2) {
        setActiveTab('radar');
      } else if (nextStepIndex === 3 || nextStepIndex === 4 || nextStepIndex === 5) {
        setActiveTab('finance');
      } else if (nextStepIndex === 6) {
        setActiveTab('analytics');
      } else if (nextStepIndex === 7) {
        setActiveTab('advice');
      }
      
      // Small delay to allow DOM to render the new tab before Joyride tries to find the target
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
          }
        }}
        locale={{
          back: 'Kembali',
          close: 'Tutup',
          last: 'Selesai',
          next: 'Lanjut',
          skip: 'Lewati'
        }}
      />
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} onStartTour={startTour}>
        {activeTab === 'radar' && (
          <Radar />
        )}
        
        {activeTab === 'finance' && (
          <Finance />
        )}
        
        {activeTab === 'advice' && (
          <Advice />
        )}

        {activeTab === 'analytics' && (
          <Analytics />
        )}
      </Layout>
      <Toaster position="top-center" richColors />
    </>
  );
}
