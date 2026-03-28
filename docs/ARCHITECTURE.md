# Arsitektur Maxxiss

## Lapisan Utama

- Frontend: `React + Vite`
- Runtime production API: root `api/*` Vercel Functions
- Runtime local-dev: adapter `Express` di `server.ts`
- ORM: Prisma
- Database: Supabase Postgres
- Cache browser: IndexedDB

## Alur Auth

1. User login dengan `username + password`
2. Server memverifikasi password hash
3. Session token opaque dibuat di server
4. Browser menerima cookie `HttpOnly`
5. Frontend memuat `/api/auth/me` lalu bootstrap data user

## Alur Data

1. UI menulis data ke cache lokal dan antrean pending
2. Jika online, queue dikirim ke `/api/sync/pending`
3. Server memproses queue secara idempotent per user
4. Server mengembalikan snapshot terbaru
5. Browser menghidrasi ulang cache dari snapshot cloud

## Isolasi Multi-user

- Semua data bisnis terikat `userId`
- User biasa hanya mengakses datanya sendiri
- Role `ADMIN` memiliki akses ke panel internal dan endpoint admin

## Konsistensi Timezone Harian

- Grouping data harian (`formattedDate`) dihitung dengan timezone bisnis (`BUSINESS_TIMEZONE`)
- Default timezone bisnis: `Asia/Jakarta`
- Tujuan: mencegah mismatch "hari ini" akibat konversi UTC pada deployment serverless global

## Rate Limiting Production

- Endpoint sensitif (`/api/auth/login` dan endpoint admin) menggunakan rate limiter terdistribusi via Upstash Redis
- Fallback behavior dikontrol `RATE_LIMIT_FAIL_CLOSED`
- Rekomendasi production: `RATE_LIMIT_FAIL_CLOSED=true`
