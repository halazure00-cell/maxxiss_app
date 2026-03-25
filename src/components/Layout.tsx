import { ReactNode, useState, useEffect } from 'react';
import { MapPin, Wallet, Zap, Wifi, WifiOff, RefreshCw, BarChart3, HelpCircle } from 'lucide-react';
import { syncDataToServer } from '../lib/sync';
import SmartToast from './SmartToast';
import FloatingSOS from './FloatingSOS';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStartTour?: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, onStartTour }: LayoutProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      await syncDataToServer();
      setIsSyncing(false);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (navigator.onLine) {
      handleOnline();
    }

    // Periodic sync every 5 minutes if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        handleOnline();
      }
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#F8F9FA] text-[#474B51]">
      <SmartToast />
      <FloatingSOS />
      {/* Header */}
      <header className="tour-header h-16 flex items-center justify-between px-4 bg-[#F8F9FA] border-b border-[#4A5D5A]/10 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#F8CB1D] rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-[#4A5D5A] font-black text-xl leading-none">M</span>
          </div>
          <h1 className="text-xl font-black tracking-tighter text-[#F8CB1D] uppercase">Maxxiss</h1>
          <button 
            onClick={onStartTour}
            className="ml-1 p-1.5 text-[#4A5D5A] hover:text-[#F8CB1D] hover:bg-[#4A5D5A]/10 rounded-full transition-colors"
            aria-label="Bantuan & Edukasi"
          >
            <HelpCircle size={20} />
          </button>
        </div>
        
        {/* Network & Sync Indicator */}
        <div className="flex items-center space-x-2">
          {isSyncing && <RefreshCw size={16} className="text-[#F8CB1D] animate-spin" />}
          {isOnline ? (
            <div className="flex items-center space-x-1 text-[#474B51] bg-[#4A5D5A]/10 px-2 py-1 rounded-full">
              <Wifi size={14} />
              <span className="text-[10px] font-bold uppercase">Online</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
              <WifiOff size={14} />
              <span className="text-[10px] font-bold uppercase">Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-6">
        {children}
      </main>

      {/* Bottom Navigation - Giant Touch Targets */}
      <nav className="bg-[#F8F9FA] border-t border-[#4A5D5A]/10 flex justify-around items-center shrink-0 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <NavButton 
          className="tour-radar-tab"
          icon={<MapPin size={28} strokeWidth={2.5} />} 
          label="Radar" 
          isActive={activeTab === 'radar'} 
          onClick={() => setActiveTab('radar')} 
        />
        <NavButton 
          className="tour-finance-tab"
          icon={<Wallet size={28} strokeWidth={2.5} />} 
          label="Keuangan" 
          isActive={activeTab === 'finance'} 
          onClick={() => setActiveTab('finance')} 
        />
        <NavButton 
          className="tour-analytics-tab"
          icon={<BarChart3 size={28} strokeWidth={2.5} />} 
          label="Analitik" 
          isActive={activeTab === 'analytics'} 
          onClick={() => setActiveTab('analytics')} 
        />
        <NavButton 
          className="tour-advice-tab"
          icon={<Zap size={28} strokeWidth={2.5} />} 
          label="Saran" 
          isActive={activeTab === 'advice'} 
          onClick={() => setActiveTab('advice')} 
        />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick, className = '' }: { icon: ReactNode, label: string, isActive: boolean, onClick: () => void, className?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full py-2 space-y-1 transition-colors ${isActive ? 'text-[#F8CB1D]' : 'text-[#474B51]'} ${className}`}
      style={{ minHeight: '72px', minWidth: '64px' }} // Ensuring minimum touch target size
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
