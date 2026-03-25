import { getCurrentUserId } from './auth';
import { clearLocalCache, getLegacySnapshot, getPendingOperations, hydrateFromBootstrap, type PendingOperationRecord } from './db';

interface BootstrapResponse {
  success: true;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: 'USER' | 'ADMIN';
    isActive: boolean;
  };
  settings: any;
  transactions: any[];
  radarLogs: any[];
  hasServerData: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload as T;
}

export async function bootstrapCurrentUser() {
  const userId = getCurrentUserId();
  if (!userId) {
    await clearLocalCache();
    return null;
  }

  const payload = await fetchJson<BootstrapResponse>('/api/bootstrap');
  await hydrateFromBootstrap(payload);
  return payload;
}

export async function syncDataToServer(options?: { forceBootstrap?: boolean }) {
  const userId = getCurrentUserId();
  if (!userId) {
    await clearLocalCache();
    return false;
  }

  const pending = await getPendingOperations();
  if (pending.length > 0) {
    const payload = await fetchJson<BootstrapResponse>('/api/sync/pending', {
      method: 'POST',
      body: JSON.stringify({
        operations: pending.map((item) => ({
          kind: item.kind,
          payload: item.payload,
        })),
      }),
    });
    await hydrateFromBootstrap(payload);
    return payload;
  }

  if (options?.forceBootstrap) {
    return bootstrapCurrentUser();
  }

  return bootstrapCurrentUser();
}

function legacySnapshotToOperations(snapshot: Awaited<ReturnType<typeof getLegacySnapshot>>) {
  const operations: Pick<PendingOperationRecord, 'kind' | 'payload'>[] = [];

  for (const transaction of snapshot.transactions) {
    operations.push({
      kind: 'transaction.create',
      payload: {
        clientKey: transaction.clientKey || `legacy-tx-${transaction.id}`,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        timestamp: transaction.timestamp,
      },
    });
  }

  for (const log of snapshot.radarLogs) {
    operations.push({
      kind: 'radar-log.create',
      payload: {
        clientKey: log.clientKey || `legacy-radar-${log.id}`,
        type: log.type,
        lat: log.lat,
        lon: log.lon,
        weather: log.weather,
        timestamp: log.timestamp,
        gross_fare: log.gross_fare,
        commission_cut: log.commission_cut,
        net_fare: log.net_fare,
      },
    });
  }

  operations.push({
    kind: 'user-settings.patch',
    payload: snapshot.settings,
  });

  return operations;
}

export async function importLegacySnapshot(snapshot?: Awaited<ReturnType<typeof getLegacySnapshot>>) {
  const resolvedSnapshot = snapshot || await getLegacySnapshot();
  const operations = legacySnapshotToOperations(resolvedSnapshot);
  if (operations.length === 0) {
    return null;
  }

  const payload = await fetchJson<BootstrapResponse>('/api/sync/pending', {
    method: 'POST',
    body: JSON.stringify({ operations }),
  });

  await hydrateFromBootstrap(payload);
  return payload;
}
