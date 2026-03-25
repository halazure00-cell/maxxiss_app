import { initDB } from './db';

// API Endpoint
const CLOUD_API_URL = '/api/sync';

export async function syncDataToServer() {
  if (!navigator.onLine) return false;

  try {
    const db = await initDB();
    
    // 1. Ambil semua data dari lokal
    const txs = await db.getAll('transactions');
    const logs = await db.getAll('radar_logs');

    // Filter data yang belum tersinkronisasi
    const unsyncedTxs = txs.filter(t => !(t as any).synced);
    const unsyncedLogs = logs.filter(l => !(l as any).synced);

    if (unsyncedTxs.length === 0 && unsyncedLogs.length === 0) {
      await cleanupOldData();
      return true; // Tidak ada data baru untuk disinkronisasi
    }

    // 2. Format JSON Pipih (Batching) untuk hemat kuota
    const settings = await db.get('user_settings', 'default');
    const payload = {
      driver_id: 'DRV-MAXXISS-001', // Mock ID
      timestamp: Date.now(),
      data: {
        transactions: unsyncedTxs.map(({ id, type, category, amount, timestamp }) => ({ id, type, category, amount, timestamp })),
        radar_logs: unsyncedLogs.map(({ id, type, lat, lon, weather, timestamp, gross_fare, commission_cut, net_fare }) => ({ id, type, lat, lon, weather, timestamp, gross_fare, commission_cut, net_fare })),
        settings: settings ? {
          commission_rate: settings.commission_rate,
          current_virtual_balance: settings.current_virtual_balance
        } : undefined
      }
    };

    console.log('Mengirim batch data ke cloud...', payload);

    // 3. Kirim ke Cloud Server
    const response = await fetch(CLOUD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      
      // Simpan saran dari server ke localStorage
      if (result.advice) {
        localStorage.setItem('maxxiss_advice', result.advice);
        // Trigger event agar UI bisa update
        window.dispatchEvent(new Event('maxxiss_advice_updated'));
      }

      // 4. Tandai sebagai tersinkronisasi
      const tx = db.transaction(['transactions', 'radar_logs'], 'readwrite');
      
      for (const item of unsyncedTxs) {
        (item as any).synced = true;
        await tx.objectStore('transactions').put(item);
      }
      
      for (const item of unsyncedLogs) {
        (item as any).synced = true;
        await tx.objectStore('radar_logs').put(item);
      }
      
      await tx.done;
      
      // 5. Bersihkan memori lokal (Hapus data lama yang sudah tersinkronisasi)
      await cleanupOldData();
      
      console.log('Sinkronisasi berhasil dan memori lokal dibersihkan.');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Gagal melakukan sinkronisasi:', error);
    return false;
  }
}

// Fungsi untuk menghapus data yang sudah tersinkronisasi dan lebih tua dari hari ini
// Ini menjaga UI tetap bisa menampilkan total hari ini, tapi memori HP tetap lega
async function cleanupOldData() {
  const db = await initDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const tx = db.transaction(['transactions', 'radar_logs'], 'readwrite');
  
  const allTxs = await tx.objectStore('transactions').getAll();
  for (const item of allTxs) {
    if (item.timestamp < todayMs && (item as any).synced) {
      await tx.objectStore('transactions').delete(item.id);
    }
  }

  const allLogs = await tx.objectStore('radar_logs').getAll();
  for (const item of allLogs) {
    if (item.timestamp < todayMs && (item as any).synced) {
      await tx.objectStore('radar_logs').delete(item.id);
    }
  }

  await tx.done;
}
