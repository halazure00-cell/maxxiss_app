# Maxxiss

Maxxiss adalah aplikasi asisten keputusan harian untuk pengemudi ojek online. Proyek ini berjalan lokal di laptop menggunakan `React + Vite` untuk frontend, `Express` untuk server lokal, dan `Prisma + SQLite` untuk penyimpanan data.

## Fitur Inti

- Pencatatan order radar dengan lokasi, cuaca, dan perhitungan komisi.
- Pencatatan keuangan harian dan saldo virtual.
- Sinkronisasi data dari IndexedDB browser ke SQLite lokal.
- Rekomendasi strategi harian dari server lokal.
- Fitur AI generatif opsional melalui `GEMINI_API_KEY`.

## Kebutuhan

- Node.js 20+
- npm 9+

## Menjalankan Secara Lokal

1. Install dependency:
   `npm install`
2. Salin environment:
   `cp .env.example .env`
3. Generate Prisma client:
   `npm run db:generate`
4. Siapkan database SQLite lokal:
   `npm run db:push`
5. Jalankan aplikasi:
   `npm run dev`
6. Buka:
   `http://localhost:3000`

## Script Penting

- `npm run dev` menjalankan server lokal dan frontend Vite pada mode development.
- `npm run build` membangun frontend production ke folder `dist`.
- `npm run start` menjalankan server lokal untuk mode production dan melayani `dist`.
- `npm run lint` menjalankan TypeScript type-check.
- `npm run db:generate` membuat Prisma client.
- `npm run db:push` membuat atau memperbarui skema SQLite lokal, dengan fallback bootstrap `sqlite3` jika `prisma db push` gagal di environment tertentu.

## Environment

- `PORT` port server lokal. Default `3000`.
- `DATABASE_URL` koneksi Prisma untuk SQLite lokal. Default `file:./dev.db`.
- `GEMINI_API_KEY` opsional. Jika tidak diisi, Maxxiss tetap berjalan memakai fallback rule-based.

## Dokumentasi Tambahan

- [Panduan setup lokal](./docs/LOCAL_SETUP.md)
- [Ringkasan arsitektur](./docs/ARCHITECTURE.md)
- [Identitas proyek](./docs/IDENTITAS_PROYEK.md)
