# Arsitektur Maxxiss

## Komponen Utama

- Frontend: `React + Vite` di folder `src`
- Server lokal: `Express` di [`server.ts`](/home/mxlinux/Downloads/maxxiss_app/server.ts)
- Database lokal: `Prisma + SQLite` di [`prisma/schema.prisma`](/home/mxlinux/Downloads/maxxiss_app/prisma/schema.prisma)

## Alur Data

1. Pengguna mencatat order dan transaksi di browser.
2. Data tersimpan lebih dulu di IndexedDB melalui utilitas `src/lib/db.ts`.
3. Proses sinkronisasi mengirim batch data ke endpoint lokal `/api/sync`.
4. Server menyimpan data ke SQLite melalui Prisma.
5. Frontend membaca data lokal browser untuk tampilan cepat, sedangkan backend menjadi sumber sinkronisasi dan advice.

## Alur Advice

1. Frontend `Advice` mengumpulkan ringkasan konteks harian dari IndexedDB.
2. Data dikirim ke endpoint `/api/advice/ai`.
3. Server mencoba memakai Gemini jika `GEMINI_API_KEY` tersedia.
4. Jika Gemini tidak aktif atau gagal, server mengembalikan advice rule-based lokal.
5. Frontend tetap menampilkan hasil tanpa mengubah desain utama tab `Advice`.

## Penyimpanan Lokal Browser

- IndexedDB menyimpan transaksi, log radar, dan pengaturan pengguna.
- LocalStorage menyimpan cache advice dan cooldown notifikasi.
- Namespace `maxxiss_*` dipakai sebagai key utama.
- Key lama `suhu_*` tetap dibaca dan dimigrasikan otomatis agar data lama tidak hilang.

## Mode Jalan Aplikasi

- Development: `tsx server.ts` menjalankan server lokal dan Vite middleware.
- Production: `vite build` menghasilkan `dist`, lalu `tsx server.ts` melayani file statis dari folder tersebut.
