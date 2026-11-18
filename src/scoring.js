export const SCALE = ['Sangat tidak sesuai', 'Tidak sesuai', 'Netral', 'Sesuai', 'Sangat sesuai']

export const CATS = [
  { min: 90, name: 'Sangat Kuat', mean: 'Kemampuan menjadi salah satu kekuatan utama.' },
  { min: 75, name: 'Kuat', mean: 'Kemampuan relatif konsisten dalam berbagai situasi.' },
  { min: 50, name: 'Cukup Berkembang', mean: 'Kemampuan terlihat dan masih dapat ditingkatkan.' },
  { min: 25, name: 'Tahap Pengembangan', mean: 'Kemampuan mulai terbentuk tetapi belum konsisten.' },
  { min: 0, name: 'Perlu Penguatan Mendasar', mean: 'Kemampuan memerlukan perhatian dan pendampingan khusus.' },
]

export const catOf = (score) => CATS.find((c) => score >= c.min) ?? CATS[CATS.length - 1]

export { fmt, dfmt, dtfmt } from './lib/format'
