import { useEffect, useCallback } from 'react';
import { getCurrentLocation, getWeather } from '../lib/location';
import { getTodayTransactions, getTodayRadarLogs } from '../lib/db';
import { toast } from 'sonner';
import { playSound } from '../lib/audio';

// Cooldown constants in milliseconds
const COOLDOWN_HEALTH = 3 * 60 * 60 * 1000; // 3 hours
const COOLDOWN_WEATHER = 4 * 60 * 60 * 1000; // 4 hours
const COOLDOWN_FRIDAY = 7 * 24 * 60 * 60 * 1000; // 1 week
const COOLDOWN_BATTERY = 1 * 60 * 60 * 1000; // 1 hour

export function useSmartSuhu() {
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
          const lastBattery = parseInt(localStorage.getItem('suhu_last_battery') || '0', 10);
          if (now - lastBattery > COOLDOWN_BATTERY) {
            showToast('Peringatan Baterai!', "Gi, baterai HP sisa belasan persen tuh! Buruan colok powerbank atau melipir cari colokan. Jangan sampai mati pas lagi bawa penumpang, nanti akun kena suspen!", 'battery');
            localStorage.setItem('suhu_last_battery', now.toString());
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Battery API not supported or blocked", e);
    }

    // 2. KONDISI 3 (Sholat Jumat)
    if (day === 5 && hours === 11 && minutes >= 30 && minutes < 35) {
      const lastFriday = parseInt(localStorage.getItem('suhu_last_friday') || '0', 10);
      if (now - lastFriday > COOLDOWN_FRIDAY) {
        showToast('Waktunya Jumatan', "Matiin dulu argo-nya, waktunya merapat ke Masjid terdekat.", 'friday');
        localStorage.setItem('suhu_last_friday', now.toString());
        return; // Only show one toast at a time
      }
    }

    // 3. HYPER LOCAL BANDUNG
    // Skenario 1: Jumat/Sabtu/Minggu jam 15.00 - 18.00
    if ([0, 5, 6].includes(day) && timeFloat >= 15 && timeFloat < 18) {
      if (localStorage.getItem('suhu_last_weekend_date') !== todayStr) {
        showToast('Info Lalu Lintas', "Sore akhir pekan nih! Area Dago, Setiabudi, sama Lembang pasti macet parah banyak plat B. Kalau dapet orderan ke atas, mending skip atau pastiin argo masuk akal sama capeknya.", 'local_weekend');
        localStorage.setItem('suhu_last_weekend_date', todayStr);
        return;
      }
    }

    // Skenario 2: Senin - Jumat jam 06.30 - 08.00
    if ([1, 2, 3, 4, 5].includes(day) && timeFloat >= 6.5 && timeFloat < 8) {
      if (localStorage.getItem('suhu_last_morning_date') !== todayStr) {
        showToast('Info Spot Gacor', "Jam sibuk anak sekolah sama orang kantoran. Merapat ke perumahan atau area padat kosan, potensi Maxim Bike lagi melimpah ruah.", 'local_morning');
        localStorage.setItem('suhu_last_morning_date', todayStr);
        return;
      }
    }

    // 4. FINANCIAL MOTIVATOR
    if (localStorage.getItem('suhu_last_finance_date') !== todayStr) {
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
          localStorage.setItem('suhu_last_finance_date', todayStr);
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
          const lastHealth = parseInt(localStorage.getItem('suhu_last_health') || '0', 10);
          if (now - lastHealth > COOLDOWN_HEALTH) {
            showToast('Peringatan Kesehatan', "Udah narik lebih dari 8 jam nih. Ingat keluarga di rumah, kesehatan nomor satu. Mending off dulu, cari warkop, lurusin kaki sama ngopi sebat.", 'health');
            localStorage.setItem('suhu_last_health', now.toString());
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to check health conditions", e);
    }

    // 6. WEATHER AWARENESS
    const lastWeather = parseInt(localStorage.getItem('suhu_last_weather') || '0', 10);
    if (now - lastWeather > COOLDOWN_WEATHER) {
      try {
        const loc = await getCurrentLocation();
        if (loc) {
          const weather = await getWeather(loc.lat, loc.lon);
          if (weather.includes('Hujan') || weather.includes('Badai')) {
            showToast('Peringatan Cuaca', "Cuaca lagi hujan nih! Aktifin jas hujan, jalanan licin. Potensi orderan Maxim Food naik drastis, tapi hati-hati bawa motornya.", 'weather');
            localStorage.setItem('suhu_last_weather', now.toString());
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
  useSmartSuhu();
  return null;
}
