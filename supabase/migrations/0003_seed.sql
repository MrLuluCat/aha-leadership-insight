-- AHA Leadership Insight - initial instrument
-- Run after 0002_functions.sql. Safe to re-run: inserts only when empty.

insert into public.dimensions (
  id, name, short_name, description, weight, strength_guidance, development_guidance, sort_order
) values
  ('b0000000-0000-4000-8000-000000000001', 'Kesadaran Diri', 'Kesadaran',
   'Mengenali nilai, pola, emosi, dan dampak diri.', 15,
   'Kesadaran diri yang kuat membantu Anda mengambil keputusan selaras nilai dan membaca dampak perilaku Anda pada tim.',
   'Luangkan lima menit tiap akhir hari untuk menulis satu keputusan dan alasan di baliknya.', 1),
  ('b0000000-0000-4000-8000-000000000002', 'Pengelolaan Diri', 'Pengelolaan',
   'Mengelola emosi, disiplin, dan konsistensi tindakan.', 15,
   'Anda mampu menjaga ketenangan dan konsistensi, sehingga menjadi jangkar bagi tim saat tekanan meningkat.',
   'Pilih satu kebiasaan kecil dan jaga konsistensinya selama 21 hari sebelum menambah yang lain.', 2),
  ('b0000000-0000-4000-8000-000000000003', 'Empati', 'Empati',
   'Memahami perspektif dan kebutuhan orang lain.', 15,
   'Empati Anda membangun rasa aman dan kepercayaan dalam percakapan sehari-hari.',
   'Dalam percakapan berikutnya, ulangi inti ucapan lawan bicara sebelum menanggapi.', 3),
  ('b0000000-0000-4000-8000-000000000004', 'Harmoni Relasi', 'Harmoni',
   'Membangun kepercayaan dan komunikasi yang sehat.', 14,
   'Kemampuan menjaga hubungan membuat konflik dapat diselesaikan tanpa merusak kepercayaan.',
   'Selesaikan satu percakapan yang tertunda minggu ini, dengan fokus pada fakta dan dampaknya.', 4),
  ('b0000000-0000-4000-8000-000000000005', 'Kolaborasi', 'Kolaborasi',
   'Menggerakkan kekuatan bersama menuju tujuan.', 14,
   'Anda menggerakkan orang melalui keterlibatan dan pengakuan atas kontribusi mereka.',
   'Sebelum memulai tugas besar, tanyakan kepada tim siapa yang paling cocok memimpin tiap bagiannya.', 5),
  ('b0000000-0000-4000-8000-000000000006', 'Adaptabilitas', 'Adaptasi',
   'Belajar, lentur, dan tangguh menghadapi perubahan.', 14,
   'Anda lentur menghadapi perubahan dan cepat mengubah pendekatan berdasarkan data.',
   'Ambil satu hal baru yang belum Anda kuasai dan minta masukan dari orang yang lebih berpengalaman.', 6),
  ('b0000000-0000-4000-8000-000000000007', 'Aksi & Ketuntasan', 'Aksi',
   'Mengubah visi menjadi keputusan dan hasil nyata.', 13,
   'Anda mengubah gagasan menjadi hasil nyata dan menuntaskan komitmen.',
   'Tentukan satu hasil terukur untuk 30 hari ke depan dan tinjau progresnya setiap minggu.', 7)
on conflict (id) do nothing;

insert into public.questions (dimension_id, question_text, weight, reverse_scoring, sort_order)
select v.dimension_id, v.question_text, 1, false, v.sort_order
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Saya tahu nilai-nilai yang paling saya pegang saat mengambil keputusan.', 1),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Saya tetap tenang saat berada di bawah tekanan.', 2),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Saya mendengarkan sampai tuntas tanpa menyela.', 3),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Saya menyampaikan pendapat dengan jujur dan tetap menghormati.', 4),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Saya melibatkan orang lain dalam mengambil keputusan yang memengaruhi mereka.', 5),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Saya menyambut perubahan sebagai peluang untuk belajar.', 6),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Saya mengubah gagasan menjadi rencana dengan langkah yang konkret.', 7),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Saya cepat menyadari emosi yang sedang muncul dalam diri saya.', 8),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Saya menjalankan komitmen meski sedang tidak bersemangat.', 9),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Saya berusaha memahami sudut pandang orang yang berbeda dari saya.', 10),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Saya menyelesaikan konflik secara langsung, tidak menunda atau menghindar.', 11),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Saya mengakui kontribusi orang lain secara terbuka.', 12),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Saya mengubah pendekatan saat data menunjukkan cara lama tidak efektif.', 13),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Saya mengambil keputusan tepat waktu dan bertanggung jawab atas hasilnya.', 14),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Saya paham situasi yang biasanya membuat saya bereaksi berlebihan.', 15),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Saya menjeda diri sebelum merespons saat marah atau kecewa.', 16),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Saya peka terhadap perubahan suasana hati orang di sekitar saya.', 17),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Saya memberi umpan balik yang jelas dan membangun.', 18),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Saya mendelegasikan tugas dengan kejelasan tujuan dan batas waktu.', 19),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Saya bangkit dengan cepat setelah mengalami kegagalan.', 20),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Saya menuntaskan pekerjaan sampai selesai, tidak berhenti di tengah.', 21),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Saya tahu bagaimana sikap saya memengaruhi suasana tim.', 22),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Saya mengatur prioritas dengan jelas dan menaatinya.', 23),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Saya bertanya tentang kebutuhan orang lain sebelum memberi solusi.', 24),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Saya menerima kritik tanpa merasa diserang.', 25),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Saya mengutamakan hasil bersama di atas pencapaian pribadi.', 26),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Saya aktif mencari ilmu dan masukan baru.', 27),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Saya menetapkan target yang jelas dan terukur.', 28),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Saya terbuka mengakui kelemahan saya.', 29),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Perkataan dan tindakan saya selaras.', 30),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Saya menghargai latar belakang dan pengalaman setiap anggota tim.', 31),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Saya menepati janji kepada orang lain.', 32),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Saya membantu rekan yang kesulitan meski itu bukan tugas saya.', 33),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Saya nyaman mengambil keputusan meski informasi belum lengkap.', 34),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Saya mengambil inisiatif tanpa menunggu perintah.', 35),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Saya rutin merefleksikan apa yang berjalan baik dan kurang baik pada diri saya.', 36),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Saya menjaga energi fisik dan mental agar tetap prima.', 37),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Orang merasa nyaman menyampaikan masalah pribadi atau pekerjaan kepada saya.', 38),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Saya menjaga hubungan baik dengan orang yang pandangannya berbeda.', 39),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Saya mampu menyatukan orang dengan keahlian yang berbeda.', 40),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Saya membantu orang lain melewati masa perubahan.', 41),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Saya menyampaikan visi dengan cara yang menggerakkan orang untuk bertindak.', 42)
) as v(dimension_id, question_text, sort_order)
where not exists (select 1 from public.questions);

insert into public.assessment_versions (version_number, configuration_snapshot, status, published_at)
select 1, public.build_config_snapshot(), 'published', now()
where not exists (select 1 from public.assessment_versions);

insert into public.assessment_versions (version_number, configuration_snapshot, status)
select 2, public.build_config_snapshot(), 'draft'
where not exists (select 1 from public.assessment_versions where status = 'draft');
