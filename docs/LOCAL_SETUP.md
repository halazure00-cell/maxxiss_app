# Local Setup Maxxiss

## Ringkasan

Maxxiss dijalankan sebagai aplikasi web lokal dengan satu server `Express` yang:

- melayani frontend Vite saat development,
- melayani hasil build `dist` saat production,
- menyediakan endpoint API lokal,
- terhubung ke database SQLite lewat Prisma.

## Langkah Setup

1. Install dependency:
   `npm install`
2. Buat file environment:
   `cp .env.example .env`
3. Generate Prisma client:
   `npm run db:generate`
4. Buat database lokal:
   `npm run db:push`
5. Jalankan development server:
   `npm run dev`

## Menjalankan Production Lokal

1. Build frontend:
   `npm run build`
2. Jalankan server production:
   `npm run start`

Server akan melayani aplikasi di `http://localhost:3000` atau mengikuti nilai `PORT`.

## Database

- Provider database: SQLite
- Lokasi file database lokal: `prisma/dev.db`
- Prisma schema: `prisma/schema.prisma`

Nilai `DATABASE_URL="file:./dev.db"` di `.env` sengaja dipakai agar Prisma tetap mengarah ke `prisma/dev.db`.

## Gemini Opsional

- Isi `GEMINI_API_KEY` jika ingin mengaktifkan saran generatif dari Gemini.
- Jika `GEMINI_API_KEY` kosong, endpoint `/api/advice/ai` tetap hidup dan otomatis mengembalikan fallback rule-based.

## Troubleshooting

- Jika Prisma gagal generate, pastikan `.env` sudah ada.
- Jika `prisma db push` gagal dengan error engine, script `npm run db:push` akan otomatis fallback ke bootstrap SQLite lewat `sqlite3`.
- Jika tab `Advice` hanya menampilkan fallback lokal, cek apakah `GEMINI_API_KEY` valid dan laptop punya koneksi internet.
- Jika data belum muncul di SQLite, pastikan server lokal aktif lalu lakukan pencatatan baru agar sinkronisasi browser ke backend berjalan.
