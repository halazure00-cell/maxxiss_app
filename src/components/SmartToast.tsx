import { useEffect, useCallback } from 'react';
import { getCurrentLocation, getWeather } from '../lib/location';
import { getTodayTransactions, getTodayRadarLogs } from '../lib/db';
import { getMigratedStorageItem, setStorageItem } from '../lib/storage';
import { toast } from 'sonner';
import { playSound } from '../lib/audio';

// Cooldown constants in milliseconds
const COOLDOWN_HEALTH = 3 * 60 * 60 * 1000; // 3 hours
const COOLDOWN_WEATHER = 4 * 60 * 60 * 1000; // 4 hours
const COOLDOWN_FRIDAY = 7 * 24 * 60 * 60 * 1000; // 1 week
const COOLDOWN_BATTERY = 1 * 60 * 60 * 1000; // 1 hour

const STORAGE_KEYS = {
  lastBattery: { current: 'maxxiss_last_battery', legacy: 'suhu_last_battery' },
  lastFriday: { current: 'maxxiss_last_friday', legacy: 'suhu_last_friday' },
  lastWeekendDate: { current: 'maxxiss_last_weekend_date', legacy: 'suhu_last_weekend_date' },
  lastMorningDate: { current: 'maxxiss_last_morning_date', legacy: 'suhu_last_morning_date' },
  lastFinanceDate: { current: 'maxxiss_last_finance_date', legacy: 'suhu_last_finance_date' },
  lastHealth: { current: 'maxxiss_last_health', legacy: 'suhu_last_health' },
  lastWeather: { current: 'maxxiss_last_weather', legacy: 'suhu_last_weather' },
} as const;

function getStoredValue(key: keyof typeof STORAGE_KEYS, fallback = '0') {
  return getMigratedStorageItem(STORAGE_KEYS[key].current, STORAGE_KEYS[key].legacy) || fallback;
}

function setStoredValue(key: keyof typeof STORAGE_KEYS, value: string) {
  setStorageItem(STORAGE_KEYS[key].current, value, STORAGE_KEYS[key].legacy);
}

export function useSmartMaxxissToast() {
  const checkConditions = useCallback(async () => {
    const now = Date.now();
    const currentDate = new Date();
    const todayStr = currentDate.toDateString();
    const day = currentDate.getDay();
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    const timeFloat = hours + minutes / 60;

    const showToast = (title: string, message: string, id: string) => {
      playSound('warning');
      toast(title, {
        description: message,
        duration: 10000,
        id: id,
      });
    };

    // 1. HARDWARE AWARENESS (Battery)
    try {
      if ('getBattery' in navigator) {
        const battery: any = await (navigator as any).getBattery();
        if (battery.level <= 0.15 && !battery.charging) {
          const lastBattery = parseInt(getStoredValue('lastBattery'), 10);
          if (now - lastBattery > COOLDOWN_BATTERY) {
            showToast('Peringatan Baterai!', "Gi, baterai HP sisa belasan persen tuh! Buruan colok powerbank atau melipir cari colokan. Jangan sampai mati pas lagi bawa penumpang, nanti akun kena suspen!", 'battery');
            setStoredValue('lastBattery', now.toString());
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Battery API not supported or blocked", e);
    }

    // 2. KONDISI 3 (Sholat Jumat)
    if (day === 5 && hours === 11 && minutes >= 30 && minutes < 35) {
      const lastFriday = parseInt(getStoredValue('lastFriday'), 10);
      if (now - lastFriday > COOLDOWN_FRIDAY) {
        showToast('Waktunya Jumatan', "Matiin dulu argo-nya, waktunya merapat ke Masjid terdekat.", 'friday');
        setStoredValue('lastFriday', now.toString());
        return; // Only show one toast at a time
      }
    }

    // 3. HYPER LOCAL BANDUNG
    // Skenario 1: Jumat/Sabtu/Minggu jam 15.00 - 18.00
    if ([0, 5, 6].includes(day) && timeFloat >= 15 && timeFloat < 18) {
      if (getStoredValue('lastWeekendDate', '') !== todayStr) {
        showToast('Info Lalu Lintas', "Sore akhir pekan nih! Area Dago, Setiabudi, sama Lembang pasti macet parah banyak plat B. Kalau dapet orderan ke atas, mending skip atau pastiin argo masuk akal sama capeknya.", 'local_weekend');
        setStoredValue('lastWeekendDate', todayStr);
        return;
      }
    }

    // Skenario 2: Senin - Jumat jam 06.30 - 08.00
    if ([1, 2, 3, 4, 5].includes(day) && timeFloat >= 6.5 && timeFloat < 8) {
      if (getStoredValue('lastMorningDate', '') !== todayStr) {
        showToast('Info Spot Gacor', "Jam sibuk anak sekolah sama orang kantoran. Merapat ke perumahan atau area padat kosan, potensi Maxim Bike lagi melimpah ruah.", 'local_morning');
        setStoredValue('lastMorningDate', todayStr);
        return;
      }
    }

    // 4. FINANCIAL MOTIVATOR
    if (getStoredValue('lastFinanceDate', '') !== todayStr) {
      try {
        const txs = await getTodayTransactions();
        const radarLogs = await getTodayRadarLogs();
        let totalIncome = 0;
        let totalExpense = 0;
        
        txs.forEach(tx => {
          if (tx.type === 'income') totalIncome += tx.amount;
          if (tx.type === 'expense') totalExpense += tx.amount;
        });
        
        radarLogs.forEach(log => {
          totalIncome += (log.net_fare || 0);
        });
        
        const balance = totalIncome - totalExpense;
        
        if (balance >= -5000 && balance <= -1000) {
          showToast('Saran Keuangan', "Tanggung bro! Kurang satu orderan Maxim Bike jarak deket lagi nih buat nutupin uang bensin sama kopi hari ini. Gas tarik satu lagi baru istirahat!", 'finance');
          setStoredValue('lastFinanceDate', todayStr);
          return;
        }
      } catch (e) {
        console.warn("Failed to calculate finance for smart toast", e);
      }
    }

    // 5. HEALTH & SAFETY (Driving too long)
    try {
      const radarLogs = await getTodayRadarLogs();
      if (radarLogs.length >= 10) {
        const firstLog = radarLogs[radarLogs.length - 1]; // oldest today
        const lastLog = radarLogs[0]; // newest today
        const hoursWorked = (lastLog.timestamp - firstLog.timestamp) / (1000 * 60 * 60);
        
        if (hoursWorked >= 8) {
          const lastHealth = parseInt(getStoredValue('lastHealth'), 10);
          if (now - lastHealth > COOLDOWN_HEALTH) {
            showToast('Peringatan Kesehatan', "Udah narik lebih dari 8 jam nih. Ingat keluarga di rumah, kesehatan nomor satu. Mending off dulu, cari warkop, lurusin kaki sama ngopi sebat.", 'health');
            setStoredValue('lastHealth', now.toString());
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to check health conditions", e);
    }

    // 6. WEATHER AWARENESS
    const lastWeather = parseInt(getStoredValue('lastWeather'), 10);
    if (now - lastWeather > COOLDOWN_WEATHER) {
      try {
        const loc = await getCurrentLocation();
        if (loc) {
          const weather = await getWeather(loc.lat, loc.lon);
          if (weather.includes('Hujan') || weather.includes('Badai')) {
            showToast('Peringatan Cuaca', "Cuaca lagi hujan nih! Aktifin jas hujan, jalanan licin. Potensi orderan Maxim Food naik drastis, tapi hati-hati bawa motornya.", 'weather');
            setStoredValue('lastWeather', now.toString());
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to check weather for smart toast", e);
      }
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkConditions();

    // Then check every 5 minutes
    const interval = setInterval(checkConditions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkConditions]);
}

export default function SmartToast() {
  useSmartMaxxissToast();
  return null;
}
