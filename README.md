# AHA Leadership Insight

Asesmen kepemimpinan tujuh dimensi dengan React 18 + Vite 5 dan backend Supabase
(PostgreSQL, Auth, RLS, RPC). Peserta mengisi asesmen tanpa login; admin mengelola
instrumen, bobot, versi, dan melihat hasil melalui dashboard.

## Menjalankan

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev            # development
npm run build          # output ke dist/
npm run preview        # cek hasil build
```

Isi `.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Ambil dari Supabase Project Settings → API. Jangan pernah menaruh service role key
di frontend. Jika env belum diisi, aplikasi menampilkan pesan konfigurasi, bukan
crash.

## Setup Supabase

Jalankan file SQL berikut secara berurutan di Supabase SQL Editor:

1. `supabase/migrations/0001_schema.sql` — tabel, index, trigger, RLS.
2. `supabase/migrations/0002_functions.sql` — RPC scoring, validasi, statistik.
3. `supabase/migrations/0003_seed.sql` — 7 dimensi + 42 pertanyaan, versi 1
   published dan versi 2 draft.

### Membuat admin pertama

1. Supabase Dashboard → Authentication → Users → **Add user** (email + password,
   centang **Auto Confirm User** agar bisa langsung login).
2. Trigger `handle_new_user` membuat profil admin **nonaktif**.
3. Aktifkan melalui SQL Editor:

```sql
update public.profiles set is_active = true where email = 'admin@example.com';
```

Admin nonaktif atau tanpa profil tetap bisa login secara teknis, tetapi tidak bisa
membaca data karena RLS dan fungsi admin memeriksa `public.is_admin()`.

Jika ada user Auth yang dibuat sebelum trigger terpasang, buat profilnya manual:

```sql
insert into public.profiles (id, email, role, is_active)
values ('<auth-user-id>', 'admin@example.com', 'admin', true)
on conflict (id) do update set is_active = true;
```

### Auth URL & signup

Supabase Dashboard → Authentication:

- **Providers → Email**: aktifkan email/password.
- **User Signups**: matikan "Allow new users to sign up" agar tidak ada registrasi
  publik. Admin hanya dibuat dari dashboard.
- **URL Configuration**: Site URL = domain produksi; Redirect URLs = domain produksi
  dan `http://localhost:5173` untuk development.

Untuk mereset password admin, gunakan Authentication → Users → kirim reset password
atau set password langsung dari dashboard.

## Arsitektur

```
src/
  App.jsx                 alur peserta (intro → quiz → laporan)
  Report.jsx              laporan hasil (radar, strengths, priorities, 21 hari)
  Admin.jsx               shell admin + proteksi sesi
  admin/                  Overview, Results, Questions, Dimensions, Versions
  services/               semua akses Supabase (assessment.js, admin.js)
  lib/                    supabase client, auth hook, format, report builder
  scoring.js              skala jawaban dan kategori hasil
supabase/migrations/      schema, RPC, seed
```

- **Scoring otoritatif ada di database** (`submit_assessment`). Frontend hanya
  menampilkan hasil dari RPC, sehingga tidak ada duplikasi logika perhitungan.
- **Snapshot konfigurasi** disimpan di `assessment_versions.configuration_snapshot`.
  Setiap sesi menunjuk versi tertentu, sehingga publikasi versi baru tidak mengubah
  sesi/hasil lama.
- **Working draft**: tabel `dimensions` dan `questions` adalah konfigurasi kerja.
  `save_configuration()` menyimpan perubahan dimensi + bobot pertanyaan secara atomik.
  `save_assessment_draft()` menyimpan snapshot draft; `publish_assessment()`
  memvalidasi (7 dimensi aktif, total bobot 100%, minimal satu pertanyaan aktif per
  dimensi, bobot > 0), mengarsipkan versi published lama, mempublikasikan draft, dan
  membuat draft berikutnya.
- **Idempotensi submit**: sesi dikunci (`for update`), dan submit ulang pada sesi
  selesai mengembalikan snapshot hasil yang sama.

## Alur admin

- **Overview** — total peserta, asesmen selesai, rata-rata index, dimensi
  tertinggi/terendah, rata-rata per dimensi, distribusi kategori, tren 12 bulan.
- **Hasil Peserta** — pencarian, filter kategori/tanggal, sorting, pagination,
  detail jawaban, ekspor CSV.
- **Pertanyaan** — tambah/edit, dimensi, bobot, reverse scoring, urutan, aktif/nonaktif
  (tanpa hard delete agar histori aman).
- **Dimensi & Bobot** — edit nama/deskripsi/narasi, bobot dimensi dengan indikator
  total langsung, tabel bobot pertanyaan, simpan draft, publikasikan.
- **Versi Asesmen** — daftar versi, status, preview snapshot, simpan/publikasi draft.

## Deployment Rumahweb

1. `npm run build`.
2. Upload seluruh isi `dist/` ke `public_html` (atau subfolder domain).
3. `public/.htaccess` sudah disertakan dan ikut tersalin ke `dist/.htaccess` sebagai
   SPA fallback (pastikan `mod_rewrite` aktif di hosting). Jika domain memakai
   subfolder, sesuaikan `RewriteBase` dan tambahkan `base` pada `vite.config.js`.
4. Pasang SSL (Let's Encrypt) dan sesuaikan Site URL Supabase ke domain tersebut.
5. Build ulang setiap kali `VITE_SUPABASE_*` berubah — Vite menanam nilainya saat build.

## Uji penerimaan cepat

1. Login dengan admin nonaktif → dashboard menolak akses.
2. Aktifkan admin, login ulang → Overview, Hasil Peserta, Pertanyaan, Dimensi &
   Bobot, Versi Asesmen dapat dibuka.
3. Buka `#/` di jendela privat → isi nama → jawab semua → kirim → laporan tampil
   dan dapat dicetak.
4. Ubah bobot dimensi menjadi tidak 100% → tombol publikasi menampilkan error
   validasi.
5. Kembalikan ke 100%, publikasikan → versi baru muncul; buka hasil peserta lama →
   skor dan versi tidak berubah.
6. Dari browser anonim, panggil `supabase.from('participants').select()` → hasil
   kosong/error karena RLS (bukan daftar peserta).

## Catatan keamanan

- RLS aktif pada seluruh tabel; role `anon` tidak memiliki policy baca langsung.
- Peserta hanya memakai RPC publik: `get_active_assessment`, `start_assessment`,
  `submit_assessment`, `get_assessment_result` (butuh session id + access token).
- Semua operasi admin memakai RPC/RLS yang memeriksa profil aktif; pemeriksaan di
  React hanya untuk UX.
- `service_role` key tidak dipakai di frontend.
