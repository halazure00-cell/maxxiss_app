import { useState, useEffect, ReactNode } from 'react';
import { addRadarLog, getTodayRadarLogs, getUserSettings, updateUserSettings } from '../lib/db';
import { getCurrentLocation, getWeather } from '../lib/location';
import { Bike, Utensils, Package, CheckCircle2, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { Numpad } from './Numpad';
import { toast } from 'sonner';
import { playSound } from '../lib/audio';
import { syncDataToServer } from '../lib/sync';

type LogStatus = 'idle' | 'loading' | 'success' | 'error';

export default function Radar() {
  const [status, setStatus] = useState<LogStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('Siap melacak titik cuan.');
  const [todayCount, setTodayCount] = useState(0);
  const [showNumpad, setShowNumpad] = useState(false);
  const [selectedOrderType, setSelectedOrderType] = useState<string | null>(null);

  const loadStats = async () => {
    const logs = await getTodayRadarLogs();
    setTodayCount(logs.length);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleOrderSelect = (type: string) => {
    playSound('click');
    setSelectedOrderType(type);
    setShowNumpad(true);
  };

  const handleLog = async (gross_fare: number) => {
    setShowNumpad(false);
    if (!selectedOrderType || status === 'loading') return;
    
    const type = selectedOrderType;
    setStatus('loading');
    setStatusMsg('Mencari lokasi & cuaca...');

    let lat: number | null = null;
    let lon: number | null = null;
    let weather = 'Offline/Timeout';

    try {
      const location = await getCurrentLocation();
      
      if (location) {
        lat = location.lat;
        lon = location.lon;
        weather = await getWeather(lat, lon);
      } else {
        weather = 'Lokasi Gagal';
      }
    } catch (err) {
      console.warn('Error during location/weather fetch', err);
      weather = 'Lokasi Gagal';
    }

    // Calculate Commission
    const settings = await getUserSettings();
    const commission_cut = Math.floor(gross_fare * (settings.commission_rate / 100));
    const net_fare = gross_fare - commission_cut;
    
    // Update Virtual Balance
    const newBalance = settings.current_virtual_balance - commission_cut;
    await updateUserSettings({ current_virtual_balance: newBalance });

    // 3. Save to IndexedDB
    await addRadarLog({
      type,
      lat,
      lon,
      weather,
      gross_fare,
      commission_cut,
      net_fare
    });
    await syncDataToServer();

    playSound('success');
    toast.success(`Order ${type.toUpperCase()} berhasil dicatat!`, {
      description: `Tarif bersih: Rp ${net_fare.toLocaleString('id-ID')} | Cuaca: ${weather}`
    });

    setStatus('success');
    setStatusMsg(`Tercatat: ${type.toUpperCase()} | ${weather}`);
    loadStats();

    // Reset status after 3 seconds
    setTimeout(() => {
      setStatus('idle');
      setStatusMsg('Siap melacak titik cuan.');
      setSelectedOrderType(null);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Status Panel */}
      <div 
        className={`p-4 rounded-2xl flex items-center space-x-3 transition-colors duration-300 ${
          status === 'idle' ? 'bg-[#4A5D5A] text-white shadow-md' :
          status === 'loading' ? 'bg-[#F8CB1D] text-[#4A5D5A] shadow-md' :
          status === 'success' ? 'bg-green-500 text-white shadow-md' :
          'bg-red-500 text-white shadow-md'
        }`}
      >
        {status === 'idle' && <MapPin size={24} className="opacity-80" />}
        {status === 'loading' && <Loader2 size={24} className="animate-spin" />}
        {status === 'success' && <CheckCircle2 size={24} />}
        {status === 'error' && <AlertCircle size={24} />}
        
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">Status Radar</span>
          <span className="text-sm font-medium">{statusMsg}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center px-2">
        <h3 className="text-sm font-bold text-[#474B51] uppercase tracking-wider">Titik Terekam Hari Ini</h3>
        <span className="text-2xl font-black text-[#F8CB1D] drop-shadow-sm">{todayCount}</span>
      </div>

      {/* One-Tap Logger Buttons */}
      <div className="tour-logger-btn flex-1 flex flex-col justify-center space-y-4">
        <LoggerBtn 
          icon={<Bike size={36} strokeWidth={2.5} />} 
          label="MAXIM BIKE" 
          onClick={() => handleOrderSelect('maxim_bike')}
          disabled={status === 'loading'}
        />
        <LoggerBtn 
          icon={<Utensils size={36} strokeWidth={2.5} />} 
          label="MAXIM FOOD&SHOP" 
          onClick={() => handleOrderSelect('maxim_food')}
          disabled={status === 'loading'}
        />
        <LoggerBtn 
          icon={<Package size={36} strokeWidth={2.5} />} 
          label="MAXIM DELIVERY" 
          onClick={() => handleOrderSelect('maxim_delivery')}
          disabled={status === 'loading'}
        />
      </div>

      {showNumpad && (
        <Numpad 
          title="MASUKKAN ARGO KOTOR"
          onConfirm={handleLog}
          onCancel={() => {
            setShowNumpad(false);
            setSelectedOrderType(null);
          }}
        />
      )}
    </div>
  );
}

function LoggerBtn({ icon, label, onClick, disabled }: { icon: ReactNode, label: string, onClick: () => void, disabled: boolean }) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isHolding && !disabled) {
      interval = setInterval(() => {
        setProgress(p => p + 5); // 1000ms total (20 steps of 50ms)
      }, 50);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isHolding, disabled]);

  useEffect(() => {
    if (progress >= 100) {
      setIsHolding(false);
      setProgress(0);
      onClick();
    }
  }, [progress, onClick]);

  return (
    <button 
      onPointerDown={() => setIsHolding(true)}
      onPointerUp={() => setIsHolding(false)}
      onPointerLeave={() => setIsHolding(false)}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      className="relative overflow-hidden rounded-[24px] flex items-center px-6 py-5 sm:p-6 disabled:opacity-50 bg-[#4A5D5A] shadow-sm select-none w-full transition-transform active:scale-[0.98]"
      style={{ minHeight: '110px', touchAction: 'none' }}
    >
      {/* Progress Background */}
      <div 
        className="absolute left-0 top-0 bottom-0 bg-black/20 transition-all duration-75 ease-linear"
        style={{ width: `${progress}%` }}
      />
      
      <div className="relative z-10 flex items-center justify-between w-full">
        <div className="flex flex-col items-start pointer-events-none">
          <span className="text-xl sm:text-2xl font-black tracking-wide text-[#F8CB1D] text-left leading-tight mb-1">{label}</span>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-white/80">
            {isHolding ? 'TAHAN TERUS...' : 'TAHAN 1 DETIK'}
          </span>
        </div>
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center shrink-0 ml-4 pointer-events-none text-[#F8CB1D]">
          {icon}
        </div>
      </div>
    </button>
  );
}
