import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Helper function to generate advice
  async function generateAdvice(driver_id: string, lat?: string, lon?: string): Promise<string> {
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Ambil data hari ini
      const todayOrders = await prisma.orderLog.findMany({
        where: { driver_id, formatted_date: today },
        orderBy: { timestamp: 'desc' }
      });

      const todayFinances = await prisma.financeLog.findMany({
        where: { driver_id, formatted_date: today }
      });

      const userSettings = await prisma.userSettings.findUnique({
        where: { driver_id }
      });

      // 2. Analisis Cuaca Terakhir atau Saat Ini
      let isRaining = false;

      if (lat && lon) {
        try {
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, {
            signal: AbortSignal.timeout(3000)
          });
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json();
            const code = weatherData.current_weather.weathercode;
            isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
          }
        } catch (e) {
          console.error("[WEATHER FETCH ERROR]", e);
        }
      }

      if (!isRaining) {
        const lastOrder = todayOrders[0];
        isRaining = !!(lastOrder && lastOrder.weather_status && 
          (lastOrder.weather_status.toLowerCase().includes('hujan') || 
           lastOrder.weather_status.toLowerCase().includes('gerimis') ||
           lastOrder.weather_status.toLowerCase().includes('badai')));
      }

      // 3. Analisis Keuangan
      let totalIncome = 0;
      let totalExpense = 0;
      
      todayFinances.forEach(f => {
        if (f.entry_type === 'income') totalIncome += f.amount;
        if (f.entry_type === 'expense') totalExpense += f.amount;
      });

      const currentHour = new Date().getHours();

      // 4. Rule-Based Engine Logic
      let advice = "TETAP SEMANGAT! CARI SPOT RAMAI TERDEKAT.";

      if (userSettings && userSettings.current_virtual_balance < 15000) {
        advice = `WARNING: SALDO MENIPIS (RP ${userSettings.current_virtual_balance.toLocaleString('id-ID')}). SEGERA TOP UP SEBELUM AKUN GAGAL NGEBID!`;
      } else if (isRaining) {
        advice = "FOKUS MAXIM FOOD&SHOP. HINDARI MAXIM BIKE SAAT HUJAN.";
      } else if (totalIncome < totalExpense) {
        advice = "ARGO MASIH MINUS. CARI ORDERAN ARAH PULANG ATAU NGETEM DI AREA PADAT KAMPUS.";
      } else if (currentHour >= 11 && currentHour <= 13) {
        advice = "JAM MAKAN SIANG. GESER KE AREA PERKANTORAN ATAU KAMPUS UNTUK MAXIM FOOD.";
      } else if (currentHour >= 16 && currentHour <= 19) {
        advice = "JAM PULANG KERJA. FOKUS MAXIM BIKE DI AREA PERKANTORAN/STASIUN.";
      } else if (totalIncome > totalExpense + 50000) {
        advice = "TARGET HARIAN TERCAPAI. PERTIMBANGKAN UNTUK ISTIRAHAT ATAU LANJUT SANTAI.";
      }

      return advice;
    } catch (error) {
      console.error("[ADVICE ERROR]", error);
      return "TETAP WASPADA DAN PATUHI RAMBU LALU LINTAS.";
    }
  }

  // POST /api/sync
  app.post("/api/sync", async (req, res) => {
    const { driver_id, data } = req.body;
    
    if (!driver_id || !data) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    console.log(`[SYNC] Menerima data dari ${driver_id}`);
    console.log(`[SYNC] Transaksi: ${data?.transactions?.length || 0}, Radar: ${data?.radar_logs?.length || 0}`);

    try {
      // Upsert UserSettings
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
          }
        });
      }

      // Upsert transactions -> FinanceLog
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
            }
          });
        }
      }

      // Upsert radar_logs -> OrderLog
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
            }
          });
        }
      }

      const advice = await generateAdvice(driver_id);

      res.json({ 
        success: true, 
        message: "Data berhasil disinkronisasi",
        advice
      });
    } catch (error) {
      console.error("[SYNC ERROR]", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // GET /api/advice
  app.get("/api/advice", async (req, res) => {
    const driver_id = req.query.driver_id as string || 'DRV-MAXXISS-001';
    const lat = req.query.lat as string;
    const lon = req.query.lon as string;
    const advice = await generateAdvice(driver_id, lat, lon);
    res.json({ advice });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
