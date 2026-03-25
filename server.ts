import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { createServer as createViteServer } from 'vite';

process.env.PORT ??= '3000';
process.env.DATABASE_URL ??= 'file:./dev.db';

const prisma = new PrismaClient();

type AdviceSource = 'gemini' | 'rule-based';

interface AdviceContextPayload {
  day?: string;
  time?: string;
  weather?: string;
  income?: number;
  expense?: number;
  daily_target?: number;
  last_order_type?: string;
}

function getTimeSlot(time: string) {
  const hour = Number.parseInt(time.split(':')[0] || '0', 10);

  if (hour >= 6 && hour <= 9) {
    return 'pagi';
  }
  if (hour >= 11 && hour <= 13) {
    return 'siang';
  }
  if (hour >= 16 && hour <= 19) {
    return 'sore';
  }
  if (hour >= 20 || hour <= 1) {
    return 'malam';
  }

  return 'di luar jam sibuk';
}

function buildRuleBasedAdviceFromContext(context: Required<AdviceContextPayload>) {
  const netBalance = context.income - context.expense;
  const weatherText = context.weather.toLowerCase();
  const timeSlot = getTimeSlot(context.time);

  let spotAdvice = '- Gaskeun cek area Stasiun Bandung, Pasteur, atau Dipatiukur. Pilih titik yang paling dekat supaya bensin tetap irit.';
  let weatherAdvice = '- Cuaca lagi aman. Pantau orderan bike dulu, lalu pindah ke titik kuliner kalau ritme penumpang mulai sepi.';
  let financeAdvice = `- Pendapatan hari ini Rp ${context.income.toLocaleString('id-ID')}. Jaga ritme sampai minimal tembus target Rp ${context.daily_target.toLocaleString('id-ID')}.`;

  if (timeSlot === 'pagi') {
    spotAdvice = '- Pagi begini fokus ke perumahan, kosan mahasiswa, atau koridor Dipatiukur - Dago buat ngejar order bike anak sekolah dan pekerja.';
  } else if (timeSlot === 'siang') {
    spotAdvice = '- Jam makan siang paling enak geser ke Asia Afrika, Lengkong Kecil, atau area kampus buat rebutan order food dan delivery.';
  } else if (timeSlot === 'sore') {
    spotAdvice = '- Sore hari mending standby di Pasteur, stasiun, atau area perkantoran karena arus pulang kerja biasanya mulai padat.';
  } else if (timeSlot === 'malam') {
    spotAdvice = '- Malam cocok muter ke Braga, Cihampelas, atau sentra kuliner Lengkong Kecil karena order nongkrong dan makan biasanya naik.';
  }

  if (weatherText.includes('hujan') || weatherText.includes('gerimis') || weatherText.includes('badai')) {
    weatherAdvice = '- Cuaca lagi basah, euy. Prioritaskan Maxim Food atau Delivery di spot kuliner padat, dan hindari ngejar order jauh yang bikin ribet di jalan.';
  } else if (context.last_order_type.toLowerCase().includes('food')) {
    weatherAdvice = '- Order terakhir condong ke food. Lanjutkan pola itu di titik kuliner ramai selama perputaran masih cepat.';
  } else if (context.last_order_type.toLowerCase().includes('bike')) {
    weatherAdvice = '- Order terakhir bike, berarti arus penumpang masih kebaca. Jaga posisi di koridor jemput yang ramai dan jangan terlalu jauh geser.';
  }

  if (netBalance < 0) {
    financeAdvice = '- Argo masih minus dibanding pengeluaran. Ambil order pendek yang rapat dulu sampai modal harian aman, baru kejar order besar.';
  } else if (context.income >= context.daily_target) {
    financeAdvice = '- Target harian sudah lewat. Kalau badan mulai capek, mending ambil order selektif saja atau siap-siap off dengan tenang.';
  } else if (context.daily_target - context.income <= 25000) {
    financeAdvice = '- Target sudah dekat banget. Tambah 1-2 order pendek yang padat, jangan tergoda order jauh yang makan waktu.';
  }

  return [spotAdvice, weatherAdvice, financeAdvice].join('\n');
}

function buildMangOdedPrompt(context: Required<AdviceContextPayload>) {
  return `Peran: Kamu adalah 'Mang Oded', legenda ojol Maxim Motor di Bandung yang hafal mati pola jalanan.

Konteks Saat Ini:
- Hari: ${context.day}
- Jam: ${context.time} WIB
- Cuaca Terakhir: ${context.weather}
- Pendapatan: Rp ${context.income}
- Target Harian: Rp ${context.daily_target}
- Pengeluaran: Rp ${context.expense}
- Orderan Terakhir: ${context.last_order_type}

Tugas: Berikan 3 poin saran mangkal/strategi yang sangat spesifik dan akurat untuk kondisi di atas.

Aturan Wajib:
1. Analisa kombinasi hari, jam, dan cuaca.
2. Sebutkan nama lokasi spesifik di Bandung.
3. Gunakan gaya bahasa Sunda akrab.
4. Jangan gunakan markdown selain tanda strip di awal tiap baris.
5. Output hanya 3 baris, masing-masing diawali tanda strip (-).`;
}

function normalizeAdviceContext(payload: AdviceContextPayload): Required<AdviceContextPayload> {
  const now = new Date();

  return {
    day: payload.day || now.toLocaleDateString('id-ID', { weekday: 'long' }),
    time: payload.time || now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    weather: payload.weather || 'Tidak diketahui',
    income: Number.isFinite(payload.income) ? Number(payload.income) : 0,
    expense: Number.isFinite(payload.expense) ? Number(payload.expense) : 0,
    daily_target: Number.isFinite(payload.daily_target) ? Number(payload.daily_target) : 100000,
    last_order_type: payload.last_order_type || 'Belum narik',
  };
}

async function generateAiAdvice(context: Required<AdviceContextPayload>): Promise<{ advice: string; source: AdviceSource }> {
  const fallbackAdvice = buildRuleBasedAdviceFromContext(context);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { advice: fallbackAdvice, source: 'rule-based' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildMangOdedPrompt(context),
    });

    const text = response.text?.trim();
    if (!text) {
      return { advice: fallbackAdvice, source: 'rule-based' };
    }

    return { advice: text, source: 'gemini' };
  } catch (error) {
    console.error('[AI ADVICE ERROR]', error);
    return { advice: fallbackAdvice, source: 'rule-based' };
  }
}

async function generateSyncAdvice(driver_id: string, lat?: string, lon?: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const todayOrders = await prisma.orderLog.findMany({
      where: { driver_id, formatted_date: today },
      orderBy: { timestamp: 'desc' },
    });

    const todayFinances = await prisma.financeLog.findMany({
      where: { driver_id, formatted_date: today },
    });

    const userSettings = await prisma.userSettings.findUnique({
      where: { driver_id },
    });

    let isRaining = false;

    if (lat && lon) {
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, {
          signal: AbortSignal.timeout(3000),
        });
        if (weatherRes.ok) {
          const weatherData = await weatherRes.json();
          const code = weatherData.current_weather.weathercode;
          isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
        }
      } catch (error) {
        console.error('[WEATHER FETCH ERROR]', error);
      }
    }

    if (!isRaining) {
      const lastOrder = todayOrders[0];
      isRaining = !!(lastOrder && lastOrder.weather_status &&
        (lastOrder.weather_status.toLowerCase().includes('hujan') ||
         lastOrder.weather_status.toLowerCase().includes('gerimis') ||
         lastOrder.weather_status.toLowerCase().includes('badai')));
    }

    let totalIncome = 0;
    let totalExpense = 0;

    todayFinances.forEach((finance) => {
      if (finance.entry_type === 'income') totalIncome += finance.amount;
      if (finance.entry_type === 'expense') totalExpense += finance.amount;
    });

    const currentHour = new Date().getHours();
    let advice = 'TETAP SEMANGAT! CARI SPOT RAMAI TERDEKAT.';

    if (userSettings && userSettings.current_virtual_balance < 15000) {
      advice = `WARNING: SALDO MENIPIS (RP ${userSettings.current_virtual_balance.toLocaleString('id-ID')}). SEGERA TOP UP SEBELUM AKUN GAGAL NGEBID!`;
    } else if (isRaining) {
      advice = 'FOKUS MAXIM FOOD&SHOP. HINDARI MAXIM BIKE SAAT HUJAN.';
    } else if (totalIncome < totalExpense) {
      advice = 'ARGO MASIH MINUS. CARI ORDERAN ARAH PULANG ATAU NGETEM DI AREA PADAT KAMPUS.';
    } else if (currentHour >= 11 && currentHour <= 13) {
      advice = 'JAM MAKAN SIANG. GESER KE AREA PERKANTORAN ATAU KAMPUS UNTUK MAXIM FOOD.';
    } else if (currentHour >= 16 && currentHour <= 19) {
      advice = 'JAM PULANG KERJA. FOKUS MAXIM BIKE DI AREA PERKANTORAN/STASIUN.';
    } else if (totalIncome > totalExpense + 50000) {
      advice = 'TARGET HARIAN TERCAPAI. PERTIMBANGKAN UNTUK ISTIRAHAT ATAU LANJUT SANTAI.';
    }

    return advice;
  } catch (error) {
    console.error('[SYNC ADVICE ERROR]', error);
    return 'TETAP WASPADA DAN PATUHI RAMBU LALU LINTAS.';
  }
}

async function startServer() {
  const app = express();
  const port = Number.parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'Maxxiss',
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    });
  });

  app.post('/api/advice/ai', async (req, res) => {
    try {
      const context = normalizeAdviceContext(req.body || {});
      const result = await generateAiAdvice(context);
      res.json(result);
    } catch (error) {
      console.error('[ADVICE API ERROR]', error);
      const fallbackContext = normalizeAdviceContext({});
      res.status(200).json({
        advice: buildRuleBasedAdviceFromContext(fallbackContext),
        source: 'rule-based',
      });
    }
  });

  app.post('/api/sync', async (req, res) => {
    const { driver_id, data } = req.body;

    if (!driver_id || !data) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    console.log(`[SYNC] Menerima data dari ${driver_id}`);
    console.log(`[SYNC] Transaksi: ${data?.transactions?.length || 0}, Radar: ${data?.radar_logs?.length || 0}`);

    try {
      if (data.settings) {
        await prisma.userSettings.upsert({
          where: { driver_id },
          update: {
            commission_rate: data.settings.commission_rate,
            current_virtual_balance: data.settings.current_virtual_balance,
          },
          create: {
            id: `${driver_id}_settings`,
            driver_id,
            commission_rate: data.settings.commission_rate,
            current_virtual_balance: data.settings.current_virtual_balance,
          },
        });
      }

      if (data.transactions && Array.isArray(data.transactions)) {
        for (const tx of data.transactions) {
          const date = new Date(tx.timestamp);
          const formatted_date = date.toISOString().split('T')[0];

          await prisma.financeLog.upsert({
            where: { id: `${driver_id}_${tx.id}` },
            update: {
              entry_type: tx.type,
              category: tx.category,
              amount: tx.amount,
            },
            create: {
              id: `${driver_id}_${tx.id}`,
              driver_id,
              timestamp: BigInt(tx.timestamp),
              formatted_date,
              entry_type: tx.type,
              category: tx.category,
              amount: tx.amount,
            },
          });
        }
      }

      if (data.radar_logs && Array.isArray(data.radar_logs)) {
        for (const log of data.radar_logs) {
          const date = new Date(log.timestamp);
          const formatted_date = date.toISOString().split('T')[0];

          await prisma.orderLog.upsert({
            where: { id: `${driver_id}_${log.id}` },
            update: {
              service_type: log.type,
              latitude: log.lat,
              longitude: log.lon,
              weather_status: log.weather,
              gross_fare: log.gross_fare,
              commission_cut: log.commission_cut,
              net_fare: log.net_fare,
            },
            create: {
              id: `${driver_id}_${log.id}`,
              driver_id,
              timestamp: BigInt(log.timestamp),
              formatted_date,
              service_type: log.type,
              latitude: log.lat,
              longitude: log.lon,
              weather_status: log.weather,
              gross_fare: log.gross_fare,
              commission_cut: log.commission_cut,
              net_fare: log.net_fare,
            },
          });
        }
      }

      const advice = await generateSyncAdvice(driver_id);

      return res.json({
        success: true,
        message: 'Data berhasil disinkronisasi',
        advice,
      });
    } catch (error) {
      console.error('[SYNC ERROR]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  app.get('/api/advice', async (req, res) => {
    const driver_id = req.query.driver_id as string || 'DRV-MAXXISS-001';
    const lat = req.query.lat as string | undefined;
    const lon = req.query.lon as string | undefined;
    const advice = await generateSyncAdvice(driver_id, lat, lon);
    res.json({ advice });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Maxxiss local server berjalan di http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('[SERVER ERROR]', error);
  process.exit(1);
});
