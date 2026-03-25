import { openDB, DBSchema } from 'idb';

interface MaxxissDB extends DBSchema {
  transactions: {
    key: number;
    value: {
      id: number;
      type: 'income' | 'expense';
      category: string;
      amount: number;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
  radar_logs: {
    key: number;
    value: {
      id: number;
      type: string;
      lat: number | null;
      lon: number | null;
      weather: string;
      timestamp: number;
      gross_fare?: number;
      commission_cut?: number;
      net_fare?: number;
    };
    indexes: { 'by-timestamp': number };
  };
  user_settings: {
    key: string;
    value: {
      id: string;
      commission_rate: number;
      current_virtual_balance: number;
      daily_target: number;
    };
  };
}

const DB_NAME = 'maxxiss-db';
const DB_VERSION = 3; // Upgraded version for new store

export const initDB = async () => {
  return openDB<MaxxissDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by-timestamp', 'timestamp');
      }
      if (oldVersion < 2) {
        const radarStore = db.createObjectStore('radar_logs', { keyPath: 'id' });
        radarStore.createIndex('by-timestamp', 'timestamp');
      }
      if (oldVersion < 3) {
        db.createObjectStore('user_settings', { keyPath: 'id' });
      }
    },
  });
};

export async function getUserSettings() {
  const db = await initDB();
  let settings = await db.get('user_settings', 'default');
  if (!settings) {
    settings = {
      id: 'default',
      commission_rate: 10,
      current_virtual_balance: 0,
      daily_target: 100000,
    };
    await db.put('user_settings', settings);
  } else if (settings.daily_target === undefined) {
    settings.daily_target = 100000;
    await db.put('user_settings', settings);
  }
  return settings;
}

export async function updateUserSettings(settings: Partial<MaxxissDB['user_settings']['value']>) {
  const db = await initDB();
  const current = await getUserSettings();
  const updated = { ...current, ...settings };
  await db.put('user_settings', updated);
  return updated;
}

export async function addTransaction(tx: Omit<MaxxissDB['transactions']['value'], 'id' | 'timestamp'>) {
  const db = await initDB();
  const timestamp = Date.now();
  await db.add('transactions', {
    ...tx,
    id: timestamp,
    timestamp,
  });
  return timestamp;
}

export async function getTodayTransactions() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const txs = await db.getAllFromIndex('transactions', 'by-timestamp');
  return txs.filter(tx => tx.timestamp >= today.getTime());
}

export async function getAllTransactions() {
  const db = await initDB();
  return db.getAllFromIndex('transactions', 'by-timestamp');
}

export async function clearTodayTransactions() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const txs = await db.getAllFromIndex('transactions', 'by-timestamp');
  const txToClear = txs.filter(tx => tx.timestamp >= today.getTime());
  
  const tx = db.transaction('transactions', 'readwrite');
  await Promise.all(txToClear.map(t => tx.store.delete(t.id)));
  await tx.done;
}

export async function addRadarLog(log: Omit<MaxxissDB['radar_logs']['value'], 'id' | 'timestamp'>) {
  const db = await initDB();
  const timestamp = Date.now();
  await db.add('radar_logs', {
    ...log,
    id: timestamp,
    timestamp,
  });
  return timestamp;
}

export async function clearTodayRadarLogs() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const logs = await db.getAllFromIndex('radar_logs', 'by-timestamp');
  const logsToClear = logs.filter(log => log.timestamp >= today.getTime());
  
  const tx = db.transaction('radar_logs', 'readwrite');
  await Promise.all(logsToClear.map(l => tx.store.delete(l.id)));
  await tx.done;
}

export async function deleteRadarLog(id: number) {
  const db = await initDB();
  const log = await db.get('radar_logs', id);
  if (log) {
    if (log.commission_cut) {
      const settings = await getUserSettings();
      await updateUserSettings({
        current_virtual_balance: settings.current_virtual_balance + log.commission_cut
      });
    }
    await db.delete('radar_logs', id);
  }
}

export async function getAllRadarLogs() {
  const db = await initDB();
  return db.getAllFromIndex('radar_logs', 'by-timestamp');
}

export async function getTodayRadarLogs() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const logs = await db.getAllFromIndex('radar_logs', 'by-timestamp');
  return logs.filter(log => log.timestamp >= today.getTime());
}
