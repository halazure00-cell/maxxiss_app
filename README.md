# Maxxiss

Maxxiss adalah aplikasi asisten keputusan harian untuk pengemudi ojek online dengan arsitektur production berbasis `Vite + React`, `Vercel Functions`, `Prisma`, dan `Supabase Postgres`.

## Fokus Produksi

- Deploy frontend sebagai SPA di Vercel
- API berjalan lewat root `api/*` Vercel Functions
- Database cloud menggunakan Supabase Postgres
- Login online kustom dengan `username + password`
- Manajemen akun user dilakukan developer melalui panel admin internal tersembunyi
- Data cloud menjadi sumber utama, IndexedDB hanya dipakai sebagai cache dan antrean sync

## Script Utama

- `npm run dev` menjalankan server lokal adapter untuk development
- `npm run dev:web` menjalankan frontend Vite murni
- `npm run dev:vercel` menjalankan `vercel dev`
- `npm run build` membangun frontend production
- `npm run start` menjalankan adapter production lokal
- `npm run lint` menjalankan type-check TypeScript
- `npm run db:generate` generate Prisma Client
- `npm run db:migrate:dev` migration development
- `npm run db:migrate:deploy` migration production/deploy
- `npm run db:push` sinkronisasi schema langsung ke database
- `npm run db:seed:admin` membuat atau memperbarui akun admin bootstrap

## Environment Penting

- `DATABASE_URL` pooled Supabase Postgres URL untuk runtime
- `DIRECT_URL` direct Supabase Postgres URL untuk Prisma migrate
- `GEMINI_API_KEY` opsional untuk advice AI generatif
- `ADMIN_BOOTSTRAP_USERNAME` akun admin awal
- `ADMIN_BOOTSTRAP_PASSWORD` password admin awal
- `ADMIN_BOOTSTRAP_DISPLAY_NAME` nama tampilan admin awal

## Alur Setup Singkat

1. Install dependency:
   `npm install`
2. Salin env:
   `cp .env.example .env`
3. Isi `DATABASE_URL`, `DIRECT_URL`, dan admin bootstrap env
4. Generate Prisma client:
   `npm run db:generate`
5. Jalankan migration:
   `npm run db:migrate:dev`
6. Seed admin pertama:
   `npm run db:seed:admin`
7. Jalankan development:
   `npm run dev`

## Dokumentasi

- [Setup lokal](./docs/LOCAL_SETUP.md)
- [Arsitektur aplikasi](./docs/ARCHITECTURE.md)
- [Deploy Vercel + Supabase](./docs/DEPLOYMENT.md)
- [Identitas proyek](./docs/IDENTITAS_PROYEK.md)
