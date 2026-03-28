# Deploy ke Vercel + Supabase

## 1. Siapkan Supabase

- Buat project Supabase baru
- Ambil pooled connection string untuk `DATABASE_URL`
- Ambil direct connection string untuk `DIRECT_URL`
- Pastikan database menerima koneksi Prisma

## 2. Siapkan Environment di Vercel

Isi environment variable berikut di project Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `GEMINI_API_KEY` jika ingin advice AI
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_DISPLAY_NAME`
- `BUSINESS_TIMEZONE` (default rekomendasi: `Asia/Jakarta`)
- `UPSTASH_REDIS_REST_URL` (wajib untuk rate limit production yang konsisten)
- `UPSTASH_REDIS_REST_TOKEN` (wajib untuk rate limit production yang konsisten)
- `RATE_LIMIT_FAIL_CLOSED` (`true` direkomendasikan)

## 3. Jalankan Migration

Sebelum production pertama:

1. `npm run db:generate`
2. `npm run db:migrate:deploy`
3. `npm run db:seed:admin`

## 4. Quality Gate Sebelum Deploy

Selalu jalankan verifikasi lokal sebelum push ke Vercel:

1. `npm run verify`
2. Pastikan `npm run verify` lolos tanpa error type-check/build

## 5. Deploy

- Build command: `npm run verify`
- Output directory: `dist`
- Konfigurasi rewrite SPA sudah ada di `vercel.json`

## 6. Verifikasi Setelah Deploy

- `GET /api/health` harus `ok`
- `GET /manifest.webmanifest` harus mengembalikan JSON manifest PWA
- `GET /sw.js` harus mengembalikan service worker script (status 200)
- `GET /icons/icon-192.svg` dan `GET /icons/icon-512.svg` harus mengembalikan image file (status 200)
- Login admin bootstrap harus berhasil
- Route `/internal/maxxiss-admin` hanya bisa diakses admin
- User baru bisa dibuat dari panel admin
- Data user tersimpan ke Supabase dan tidak bercampur antar akun
- Rate limit login/admin tetap konsisten antar cold start (uji dengan burst request)

## 7. Verifikasi Install PWA

- Buka aplikasi di Chrome Android dan pastikan prompt install muncul.
- Setelah install, pastikan ikon aplikasi menggunakan aset ikon aplikasi (bukan placeholder).
- Aktifkan mode pesawat lalu buka ulang aplikasi untuk memastikan shell utama tetap dapat dibuka dari cache service worker.
