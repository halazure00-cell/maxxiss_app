import { GoogleGenAI } from '@google/genai';
import { Prisma, type AppUser, type FinanceLog, type OrderLog, type UserSettings } from '@prisma/client';
import { prisma } from './prisma';

export interface PendingOperation {
  kind: 'transaction.create' | 'radar-log.create' | 'radar-log.delete' | 'user-settings.patch' | 'day.reset.today';
  payload: Record<string, any>;
}

interface AdviceContextPayload {
  day: string;
  time: string;
  weather: string;
  income: number;
  expense: number;
  dailyTarget: number;
  lastOrderType: string;
}

function toNumber(value: Prisma.Decimal | number | bigint | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function formatDateFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0];
}

export function serializeFinanceLog(log: FinanceLog) {
  return {
    id: log.id,
    clientKey: log.clientKey,
    type: log.entryType as 'income' | 'expense',
    category: log.category,
    amount: toNumber(log.amount),
    timestamp: Number(log.timestamp),
    synced: true,
  };
}

export function serializeOrderLog(log: OrderLog) {
  return {
    id: log.id,
    clientKey: log.clientKey,
    type: log.serviceType,
    lat: log.latitude,
    lon: log.longitude,
    weather: log.weatherStatus || 'Tidak diketahui',
    timestamp: Number(log.timestamp),
    gross_fare: log.grossFare ? toNumber(log.grossFare) : undefined,
    commission_cut: log.commissionCut ? toNumber(log.commissionCut) : undefined,
    net_fare: log.netFare ? toNumber(log.netFare) : undefined,
    synced: true,
  };
}

export function serializeUserSettings(settings: UserSettings) {
  return {
    id: 'default',
    commission_rate: settings.commissionRate,
    current_virtual_balance: toNumber(settings.currentVirtualBalance),
    daily_target: toNumber(settings.dailyTarget),
    synced: true,
  };
}

export async function ensureUserSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
    },
  });
}

export async function getBootstrapPayload(user: AppUser) {
  const [settings, transactions, radarLogs] = await Promise.all([
    ensureUserSettings(user.id),
    prisma.financeLog.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.orderLog.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'asc' },
    }),
  ]);

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    },
    settings: serializeUserSettings(settings),
    transactions: transactions.map(serializeFinanceLog),
    radarLogs: radarLogs.map(serializeOrderLog),
    hasServerData: transactions.length > 0 || radarLogs.length > 0,
  };
}

export async function createTransaction(userId: string, payload: Record<string, any>) {
  const clientKey = String(payload.clientKey || '').trim();
  const type = payload.type === 'income' ? 'income' : 'expense';
  const category = String(payload.category || '').trim();
  const amount = Number(payload.amount || 0);
  const timestamp = Number(payload.timestamp || Date.now());

  if (!clientKey || !category || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid transaction payload');
  }

  const transaction = await prisma.financeLog.upsert({
    where: {
      userId_clientKey: {
        userId,
        clientKey,
      },
    },
    update: {
      entryType: type,
      category,
      amount,
      timestamp: BigInt(timestamp),
      formattedDate: formatDateFromTimestamp(timestamp),
    },
    create: {
      userId,
      clientKey,
      entryType: type,
      category,
      amount,
      timestamp: BigInt(timestamp),
      formattedDate: formatDateFromTimestamp(timestamp),
    },
  });

  return serializeFinanceLog(transaction);
}

export async function patchUserSettings(userId: string, payload: Record<string, any>) {
  const current = await ensureUserSettings(userId);

  const commissionRate = payload.commissionRate ?? payload.commission_rate;
  const currentVirtualBalance = payload.currentVirtualBalance ?? payload.current_virtual_balance;
  const dailyTarget = payload.dailyTarget ?? payload.daily_target;

  const settings = await prisma.userSettings.update({
    where: { userId },
    data: {
      commissionRate: Number.isFinite(Number(commissionRate)) ? Number(commissionRate) : current.commissionRate,
      currentVirtualBalance: Number.isFinite(Number(currentVirtualBalance)) ? Number(currentVirtualBalance) : current.currentVirtualBalance,
      dailyTarget: Number.isFinite(Number(dailyTarget)) ? Number(dailyTarget) : current.dailyTarget,
    },
  });

  return serializeUserSettings(settings);
}

export async function createRadarLog(userId: string, payload: Record<string, any>) {
  const clientKey = String(payload.clientKey || '').trim();
  const type = String(payload.type || '').trim();
  const timestamp = Number(payload.timestamp || Date.now());
  const grossFare = payload.gross_fare ?? payload.grossFare;
  const commissionCut = payload.commission_cut ?? payload.commissionCut;
  const netFare = payload.net_fare ?? payload.netFare;

  if (!clientKey || !type || !Number.isFinite(timestamp)) {
    throw new Error('Invalid radar log payload');
  }

  const radarLog = await prisma.orderLog.upsert({
    where: {
      userId_clientKey: {
        userId,
        clientKey,
      },
    },
    update: {
      serviceType: type,
      latitude: payload.lat ?? payload.latitude ?? null,
      longitude: payload.lon ?? payload.longitude ?? null,
      weatherStatus: payload.weather || payload.weatherStatus || 'Tidak diketahui',
      grossFare: Number.isFinite(Number(grossFare)) ? Number(grossFare) : null,
      commissionCut: Number.isFinite(Number(commissionCut)) ? Number(commissionCut) : null,
      netFare: Number.isFinite(Number(netFare)) ? Number(netFare) : null,
      timestamp: BigInt(timestamp),
      formattedDate: formatDateFromTimestamp(timestamp),
    },
    create: {
      userId,
      clientKey,
      serviceType: type,
      latitude: payload.lat ?? payload.latitude ?? null,
      longitude: payload.lon ?? payload.longitude ?? null,
      weatherStatus: payload.weather || payload.weatherStatus || 'Tidak diketahui',
      grossFare: Number.isFinite(Number(grossFare)) ? Number(grossFare) : null,
      commissionCut: Number.isFinite(Number(commissionCut)) ? Number(commissionCut) : null,
      netFare: Number.isFinite(Number(netFare)) ? Number(netFare) : null,
      timestamp: BigInt(timestamp),
      formattedDate: formatDateFromTimestamp(timestamp),
    },
  });

  return serializeOrderLog(radarLog);
}

export async function deleteRadarLog(userId: string, id: string) {
  const existing = await prisma.orderLog.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existing) {
    return { success: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderLog.delete({
      where: { id: existing.id },
    });

    if (existing.commissionCut) {
      const settings = await tx.userSettings.findUnique({
        where: { userId },
      });

      if (settings) {
        await tx.userSettings.update({
          where: { userId },
          data: {
            currentVirtualBalance: settings.currentVirtualBalance.plus(existing.commissionCut),
          },
        });
      }
    }
  });

  return { success: true };
}

export async function resetTodayData(userId: string) {
  const formattedDate = new Date().toISOString().split('T')[0];

  await prisma.$transaction([
    prisma.financeLog.deleteMany({
      where: {
        userId,
        formattedDate,
      },
    }),
    prisma.orderLog.deleteMany({
      where: {
        userId,
        formattedDate,
      },
    }),
  ]);

  return { success: true };
}

export async function applyPendingOperations(userId: string, operations: PendingOperation[]) {
  for (const operation of operations) {
    if (operation.kind === 'transaction.create') {
      await createTransaction(userId, operation.payload);
      continue;
    }

    if (operation.kind === 'radar-log.create') {
      await createRadarLog(userId, operation.payload);
      continue;
    }

    if (operation.kind === 'radar-log.delete') {
      await deleteRadarLog(userId, String(operation.payload.id || ''));
      continue;
    }

    if (operation.kind === 'user-settings.patch') {
      await patchUserSettings(userId, operation.payload);
      continue;
    }

    if (operation.kind === 'day.reset.today') {
      await resetTodayData(userId);
    }
  }
}

function getTimeSlot(time: string) {
  const hour = Number.parseInt(time.split(':')[0] || '0', 10);

  if (hour >= 6 && hour <= 9) return 'pagi';
  if (hour >= 11 && hour <= 13) return 'siang';
  if (hour >= 16 && hour <= 19) return 'sore';
  if (hour >= 20 || hour <= 1) return 'malam';
  return 'di luar jam sibuk';
}

function buildRuleBasedAdviceFromContext(context: AdviceContextPayload) {
  const netBalance = context.income - context.expense;
  const weatherText = context.weather.toLowerCase();
  const timeSlot = getTimeSlot(context.time);

  let spotAdvice = '- Gaskeun cek area Stasiun Bandung, Pasteur, atau Dipatiukur. Pilih titik yang paling dekat supaya bensin tetap irit.';
  let weatherAdvice = '- Cuaca lagi aman. Pantau orderan bike dulu, lalu pindah ke titik kuliner kalau ritme penumpang mulai sepi.';
  let financeAdvice = `- Pendapatan hari ini Rp ${context.income.toLocaleString('id-ID')}. Jaga ritme sampai minimal tembus target Rp ${context.dailyTarget.toLocaleString('id-ID')}.`;

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
  } else if (context.lastOrderType.toLowerCase().includes('food')) {
    weatherAdvice = '- Order terakhir condong ke food. Lanjutkan pola itu di titik kuliner ramai selama perputaran masih cepat.';
  } else if (context.lastOrderType.toLowerCase().includes('bike')) {
    weatherAdvice = '- Order terakhir bike, berarti arus penumpang masih kebaca. Jaga posisi di koridor jemput yang ramai dan jangan terlalu jauh geser.';
  }

  if (netBalance < 0) {
    financeAdvice = '- Argo masih minus dibanding pengeluaran. Ambil order pendek yang rapat dulu sampai modal harian aman, baru kejar order besar.';
  } else if (context.income >= context.dailyTarget) {
    financeAdvice = '- Target harian sudah lewat. Kalau badan mulai capek, mending ambil order selektif saja atau siap-siap off dengan tenang.';
  } else if (context.dailyTarget - context.income <= 25000) {
    financeAdvice = '- Target sudah dekat banget. Tambah 1-2 order pendek yang padat, jangan tergoda order jauh yang makan waktu.';
  }

  return [spotAdvice, weatherAdvice, financeAdvice].join('\n');
}

function buildMangOdedPrompt(context: AdviceContextPayload) {
  return `Peran: Kamu adalah 'Mang Oded', legenda ojol Maxim Motor di Bandung yang hafal mati pola jalanan.

Konteks Saat Ini:
- Hari: ${context.day}
- Jam: ${context.time} WIB
- Cuaca Terakhir: ${context.weather}
- Pendapatan: Rp ${context.income}
- Target Harian: Rp ${context.dailyTarget}
- Pengeluaran: Rp ${context.expense}
- Orderan Terakhir: ${context.lastOrderType}

Tugas: Berikan 3 poin saran mangkal/strategi yang sangat spesifik dan akurat untuk kondisi di atas.

Aturan Wajib:
1. Analisa kombinasi hari, jam, dan cuaca.
2. Sebutkan nama lokasi spesifik di Bandung.
3. Gunakan gaya bahasa Sunda akrab.
4. Jangan gunakan markdown selain tanda strip di awal tiap baris.
5. Output hanya 3 baris, masing-masing diawali tanda strip (-).`;
}

async function buildAdviceContextForUser(userId: string): Promise<AdviceContextPayload> {
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];

  const [settings, transactions, radarLogs] = await Promise.all([
    ensureUserSettings(userId),
    prisma.financeLog.findMany({
      where: { userId, formattedDate },
    }),
    prisma.orderLog.findMany({
      where: { userId, formattedDate },
      orderBy: { timestamp: 'desc' },
    }),
  ]);

  const incomeFromTransactions = transactions
    .filter((item) => item.entryType === 'income')
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const expense = transactions
    .filter((item) => item.entryType === 'expense')
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const incomeFromOrders = radarLogs.reduce((sum, item) => sum + toNumber(item.netFare), 0);
  const lastOrder = radarLogs[0];

  return {
    day: today.toLocaleDateString('id-ID', { weekday: 'long' }),
    time: today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    weather: lastOrder?.weatherStatus || 'Tidak diketahui',
    income: incomeFromTransactions + incomeFromOrders,
    expense,
    dailyTarget: toNumber(settings.dailyTarget),
    lastOrderType: lastOrder?.serviceType.replace(/_/g, ' ') || 'Belum narik',
  };
}

export async function generateAdviceForUser(userId: string) {
  const context = await buildAdviceContextForUser(userId);
  const fallbackAdvice = buildRuleBasedAdviceFromContext(context);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { advice: fallbackAdvice, source: 'rule-based' as const };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildMangOdedPrompt(context),
    });

    const text = response.text?.trim();
    if (!text) {
      return { advice: fallbackAdvice, source: 'rule-based' as const };
    }

    return { advice: text, source: 'gemini' as const };
  } catch (error) {
    console.error('[AI ADVICE ERROR]', error);
    return { advice: fallbackAdvice, source: 'rule-based' as const };
  }
}
