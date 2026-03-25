import { openDB, type DBSchema } from 'idb';

export interface TransactionRecord {
  id: string;
  clientKey: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  timestamp: number;
  synced?: boolean;
}

export interface RadarLogRecord {
  id: string;
  clientKey: string;
  type: string;
  lat: number | null;
  lon: number | null;
  weather: string;
  timestamp: number;
  gross_fare?: number;
  commission_cut?: number;
  net_fare?: number;
  synced?: boolean;
}

export interface UserSettingsRecord {
  id: string;
  commission_rate: number;
  current_virtual_balance: number;
  daily_target: number;
  synced?: boolean;
}

export interface PendingOperationRecord {
  id: string;
  kind: 'transaction.create' | 'radar-log.create' | 'radar-log.delete' | 'user-settings.patch' | 'day.reset.today';
  payload: Record<string, any>;
  createdAt: number;
}

interface MetaRecord {
  key: string;
  value: string;
}

interface MaxxissDB extends DBSchema {
  transactions: {
    key: string;
    value: TransactionRecord;
    indexes: { 'by-timestamp': number };
  };
  radar_logs: {
    key: string;
    value: RadarLogRecord;
    indexes: { 'by-timestamp': number };
  };
  user_settings: {
    key: string;
    value: UserSettingsRecord;
  };
  pending_ops: {
    key: string;
    value: PendingOperationRecord;
    indexes: { 'by-createdAt': number };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

const DB_NAME = 'maxxiss-db';
const DB_VERSION = 5;

function createDefaultSettings(): UserSettingsRecord {
  return {
    id: 'default',
    commission_rate: 10,
    current_virtual_balance: 0,
    daily_target: 100000,
    synced: true,
  };
}

export async function initDB() {
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
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('pending_ops')) {
          const pendingStore = db.createObjectStore('pending_ops', { keyPath: 'id' });
          pendingStore.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      }
    },
  });
}

async function putMeta(key: string, value: string) {
  const db = await initDB();
  await db.put('meta', { key, value });
}

async function getMeta(key: string) {
  const db = await initDB();
  const meta = await db.get('meta', key);
  return meta?.value || null;
}

async function enqueuePendingOperation(kind: PendingOperationRecord['kind'], payload: Record<string, any>) {
  const db = await initDB();
  const operation: PendingOperationRecord = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: Date.now(),
  };

  await db.put('pending_ops', operation);
  return operation;
}

async function deletePendingCreateByClientKey(kind: PendingOperationRecord['kind'], clientKey: string) {
  const db = await initDB();
  const ops = await db.getAllFromIndex('pending_ops', 'by-createdAt');
  const match = ops.find((op) => op.kind === kind && op.payload.clientKey === clientKey);
  if (match) {
    await db.delete('pending_ops', match.id);
  }
}

export async function clearPendingOperations() {
  const db = await initDB();
  const tx = db.transaction('pending_ops', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function getPendingOperations() {
  const db = await initDB();
  return db.getAllFromIndex('pending_ops', 'by-createdAt');
}

export async function hasPendingOperations() {
  const pending = await getPendingOperations();
  return pending.length > 0;
}

export async function getUserSettings() {
  const db = await initDB();
  let settings = await db.get('user_settings', 'default');
  if (!settings) {
    settings = createDefaultSettings();
    await db.put('user_settings', settings);
  }
  return settings;
}

export async function updateUserSettings(settings: Partial<UserSettingsRecord>) {
  const db = await initDB();
  const current = await getUserSettings();
  const updated: UserSettingsRecord = {
    ...current,
    ...settings,
    id: 'default',
    synced: false,
  };

  await db.put('user_settings', updated);
  await enqueuePendingOperation('user-settings.patch', updated);
  return updated;
}

export async function addTransaction(tx: Omit<TransactionRecord, 'id' | 'clientKey' | 'timestamp' | 'synced'>) {
  const db = await initDB();
  const timestamp = Date.now();
  const clientKey = crypto.randomUUID();
  const record: TransactionRecord = {
    ...tx,
    id: `local-${clientKey}`,
    clientKey,
    timestamp,
    synced: false,
  };

  await db.put('transactions', record);
  await enqueuePendingOperation('transaction.create', record);
  return record.id;
}

export async function getTodayTransactions() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const txs = await db.getAllFromIndex('transactions', 'by-timestamp');
  return txs.filter((tx) => tx.timestamp >= today.getTime());
}

export async function getAllTransactions() {
  const db = await initDB();
  return db.getAllFromIndex('transactions', 'by-timestamp');
}

export async function addRadarLog(log: Omit<RadarLogRecord, 'id' | 'clientKey' | 'timestamp' | 'synced'>) {
  const db = await initDB();
  const timestamp = Date.now();
  const clientKey = crypto.randomUUID();
  const record: RadarLogRecord = {
    ...log,
    id: `local-${clientKey}`,
    clientKey,
    timestamp,
    synced: false,
  };

  await db.put('radar_logs', record);
  await enqueuePendingOperation('radar-log.create', record);
  return record.id;
}

export async function deleteRadarLog(id: string) {
  const db = await initDB();
  const log = await db.get('radar_logs', id);
  if (!log) {
    return;
  }

  if (log.commission_cut) {
    const settings = await getUserSettings();
    await db.put('user_settings', {
      ...settings,
      current_virtual_balance: settings.current_virtual_balance + log.commission_cut,
      synced: false,
    });
  }

  await db.delete('radar_logs', id);

  if (!log.synced && log.clientKey) {
    await deletePendingCreateByClientKey('radar-log.create', log.clientKey);
    return;
  }

  await enqueuePendingOperation('radar-log.delete', { id });
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
  return logs.filter((log) => log.timestamp >= today.getTime());
}

export async function resetTodayData() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const transactionTx = db.transaction(['transactions', 'radar_logs'], 'readwrite');
  const allTxs = await transactionTx.objectStore('transactions').getAll();
  for (const item of allTxs) {
    if (item.timestamp >= todayMs) {
      await transactionTx.objectStore('transactions').delete(item.id);
    }
  }

  const allLogs = await transactionTx.objectStore('radar_logs').getAll();
  for (const item of allLogs) {
    if (item.timestamp >= todayMs) {
      await transactionTx.objectStore('radar_logs').delete(item.id);
    }
  }

  await transactionTx.done;
  await enqueuePendingOperation('day.reset.today', {});
}

export async function clearTodayTransactions() {
  await resetTodayData();
}

export async function clearTodayRadarLogs() {
  await resetTodayData();
}

export async function clearLocalCache() {
  const db = await initDB();
  const tx = db.transaction(['transactions', 'radar_logs', 'user_settings', 'pending_ops'], 'readwrite');
  await tx.objectStore('transactions').clear();
  await tx.objectStore('radar_logs').clear();
  await tx.objectStore('user_settings').clear();
  await tx.objectStore('pending_ops').clear();
  await tx.done;
}

export async function hydrateFromBootstrap(payload: {
  settings: UserSettingsRecord;
  transactions: TransactionRecord[];
  radarLogs: RadarLogRecord[];
}) {
  const db = await initDB();
  const tx = db.transaction(['transactions', 'radar_logs', 'user_settings', 'pending_ops'], 'readwrite');

  await tx.objectStore('transactions').clear();
  await tx.objectStore('radar_logs').clear();
  await tx.objectStore('pending_ops').clear();

  for (const item of payload.transactions) {
    await tx.objectStore('transactions').put({
      ...item,
      synced: true,
    });
  }

  for (const item of payload.radarLogs) {
    await tx.objectStore('radar_logs').put({
      ...item,
      synced: true,
    });
  }

  await tx.objectStore('user_settings').put({
    ...payload.settings,
    id: 'default',
    synced: true,
  });

  await tx.done;
}

export async function getLegacySnapshot() {
  const [transactions, radarLogs, settings] = await Promise.all([
    getAllTransactions(),
    getAllRadarLogs(),
    getUserSettings(),
  ]);

  return {
    transactions,
    radarLogs,
    settings,
  };
}

export async function hasLegacyLocalData() {
  const snapshot = await getLegacySnapshot();
  return snapshot.transactions.length > 0 || snapshot.radarLogs.length > 0;
}

export async function markLegacyMigrationCompleted(userId: string) {
  await putMeta(`legacy-imported:${userId}`, 'true');
}

export async function hasCompletedLegacyMigration(userId: string) {
  return (await getMeta(`legacy-imported:${userId}`)) === 'true';
}
