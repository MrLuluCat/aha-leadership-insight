# AHA Leadership Insight

Asesmen kepemimpinan tujuh dimensi dengan React 18 + Vite 5 dan backend Supabase
(PostgreSQL, Auth, RLS, RPC). Peserta mengisi asesmen tanpa login; admin mengelola
instrumen, bobot, versi, hasil peserta, serta backup & pengelolaan dataset melalui dashboard.

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

Ambil dari Supabase Project Settings → API. Jangan pernah menaruh `service_role` key
di frontend. Jika env belum diisi, aplikasi menampilkan pesan konfigurasi, bukan crash.

## Setup Supabase

Jalankan file SQL berikut secara berurutan di Supabase SQL Editor:

1. `supabase/migrations/0001_schema.sql` — tabel, index, trigger, RLS.
2. `supabase/migrations/0002_functions.sql` — RPC scoring, validasi, statistik.
3. `supabase/migrations/0003_seed.sql` — 7 dimensi + pertanyaan awal, versi 1
   published dan versi 2 draft.
4. `supabase/migrations/0004_restore_rpc.sql` — RPC `admin_restore_full_backup`
   (restore lintas-database lengkap: dimensi, pertanyaan, versi, hasil & jawaban peserta)
   dan `admin_delete_result`.

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
  App.jsx                 alur peserta (intro → quiz → laporan) + lazy loading
  Report.jsx              laporan hasil (radar, strengths, priorities, 21 hari, cetak PDF, Excel)
  Admin.jsx               shell admin, sidebar navigasi, proteksi sesi
  admin/
    AdminLogin.jsx        halaman login admin
    Overview.jsx          ringkasan statistik, rata-rata dimensi, distribusi, tren
    Results.jsx           tabel hasil peserta, filter tanggal/kategori, detail & ekspor
    Questions.jsx         bank pertanyaan (CRUD modal, filter, bobot, reverse scoring)
    Dimensions.jsx        editor dimensi & bobot (donut validasi 100%, hints, bobot soal)
    Versions.jsx          riwayat snapshot versi asesmen
    DataManagement.jsx    pusat backup CSV/JSON, restore konfigurasi, cleanup & diagnostik
    CustomDatePicker.jsx  kalender rentang tanggal kustom (responsif mobile)
    CustomSelect.jsx      dropdown select kustom dengan auto-placement
    TrendChart.jsx        grafik SVG tren peserta bulanan
    icons.jsx             ikon SVG terpadu
  components/
    PageLoader.jsx        skeleton shimmer untuk lazy loading per halaman
  services/               semua akses Supabase (assessment.js, admin.js)
  lib/                    supabase client, auth hook, format tanggal/waktu, report builder, exportExcel
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
  memvalidasi dimensi aktif, total bobot 100%, minimal satu pertanyaan aktif per
  dimensi, bobot > 0, mengarsipkan versi published lama, mempublikasikan draft, dan
  membuat draft berikutnya.
- **Idempotensi submit**: sesi dikunci (`for update`), dan submit ulang pada sesi
  selesai mengembalikan snapshot hasil yang sama.

## Alur admin

- **Dashboard (Overview)** — total peserta, asesmen selesai, rata-rata index, dimensi
  tertinggi/terendah, rata-rata per dimensi, distribusi kategori, tren 6/12 bulan.
- **Hasil Peserta** — pencarian, filter kategori & rentang tanggal, sorting,
  pagination, timestamp pengerjaan lengkap (`HH:mm:ss`), detail laporan + tabel jawaban,
  cetak / simpan PDF A4, ekspor Excel (`.xls`), dan ekspor CSV.
- **Pertanyaan** — tambah/edit/hapus via modal, dimensi, bobot, reverse scoring,
  urutan, aktif/nonaktif dengan tombol ikon aksi yang responsif.
- **Dimensi & Bobot** — editor bertab per dimensi, indikator donut total bobot `100%`,
  bantuan interaktif (`?`), tabel bobot pertanyaan, simpan draf/perubahan, publikasikan.
- **Versi Asesmen** — daftar versi, status, preview snapshot konfigurasi, simpan/publikasi draft.
- **Kelola Data & Backup** —
  - **Backup Utama Hasil Asesmen Peserta (`.CSV`)**: satu baris per peserta lengkap
    dengan skor ke-7 dimensi, *Top 3 Strengths*, *Development Priorities*, *21-Day Action Plan*,
    serta seluruh jawaban per butir pertanyaan.
  - **Full Master Database Backup (`.CSV`) & Snapshot (`.JSON`)**: mencadangkan seluruh
    tabel database (`dimensions`, `questions`, `assessment_versions`, hasil, skor,
    jawaban, insight laporan, `profiles`, `participants`, `assessment_sessions`).
  - **Backup CSV per Tabel**, **Restore Konfigurasi** (`.CSV`/`.JSON`) dengan pratinjau
    perbandingan bobot ke *Working Draft*, **Pembersihan Data & Deteksi Duplikat**,
    serta **Diagnostik Kesehatan Dataset**.

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
   Bobot, Versi Asesmen, dan Kelola Data dapat dibuka.
3. Buka `#/` di jendela privat → isi nama → jawab semua → kirim → laporan tampil,
   dapat diekspor ke Excel, dan dapat dicetak ke PDF.
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
