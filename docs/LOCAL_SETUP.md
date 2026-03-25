# Local Setup Maxxiss

## Prasyarat

- Node.js 20+
- npm 9+
- Database Supabase Postgres aktif

## Langkah Setup

1. Install dependency:
   `npm install`
2. Salin env:
   `cp .env.example .env`
3. Isi `DATABASE_URL` dan `DIRECT_URL` dari Supabase
4. Isi admin bootstrap env
5. Generate Prisma client:
   `npm run db:generate`
6. Jalankan migration:
   `npm run db:migrate:dev`
7. Seed admin pertama:
   `npm run db:seed:admin`
8. Jalankan server lokal:
   `npm run dev`

## Akses Lokal

- App utama: `http://localhost:3000`
- Panel admin tersembunyi: `http://localhost:3000/internal/maxxiss-admin`

Panel admin tidak muncul di UI publik. Aksesnya tetap dicek berdasarkan role akun admin.
