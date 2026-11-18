import { catOf } from '../scoring'

const guidance = (dim, key) => {
  const value = dim?.[key]?.trim()
  if (value) return value
  return key === 'strength_guidance'
    ? 'Jadikan kemampuan ini sebagai modal untuk mendukung pengembangan diri dan tim.'
    : 'Tetapkan satu tindakan kecil yang dapat diukur dan tinjau progresnya setiap minggu.'
}

const lower = (dim) => (dim?.name || 'dimensi').toLowerCase()

export function buildReport(result) {
  if (!result) return null

  const configDims = new Map((result.config?.dimensions ?? []).map((d) => [d.id, d]))
  const dimensions = (result.dimension_scores ?? []).map((d) => {
    const config = configDims.get(d.id) ?? {}
    return {
      ...config,
      ...d,
      strength_guidance: guidance(config, 'strength_guidance'),
      development_guidance: guidance(config, 'development_guidance'),
    }
  })

  const sorted = [...dimensions].sort((a, b) => b.score - a.score)
  const strengths = sorted.slice(0, 3)
  const priorities = sorted.slice(-3).reverse()

  const overall = Number(result.overall_score ?? 0)
  const category = result.category ?? catOf(overall)
  const p1 = priorities[0] ?? dimensions[0]
  const p2 = priorities[1] ?? p1
  const top = strengths[0] ?? dimensions[0]

  const plan = [
    {
      days: 'Hari 1–7',
      title: 'Awareness',
      focus: `Mengenali pola ${lower(p1)}`,
      actions: [
        `Catat satu situasi harian yang menguji ${lower(p1)} dan respons yang Anda pilih.`,
        guidance(p1, 'development_guidance'),
        `Minta satu rekan memberi umpan balik tentang ${lower(p1)} Anda.`,
      ],
    },
    {
      days: 'Hari 8–14',
      title: 'Practice',
      focus: `Melatih ${p1?.name ?? 'dimensi prioritas'} dan ${p2?.name ?? 'dimensi pendukung'}`,
      actions: [
        `Terapkan satu tindakan spesifik dari catatan minggu pertama pada ${lower(p1)}.`,
        guidance(p2, 'development_guidance'),
        'Tinjau progres bersama rekan dan sesuaikan pendekatan bila perlu.',
      ],
    },
    {
      days: 'Hari 15–21',
      title: 'Active Impact',
      focus: 'Membawa perubahan ke tim',
      actions: [
        `Gunakan kekuatan ${lower(top)} untuk mendukung latihan ${lower(p1)}.`,
        'Bagikan satu pembelajaran kepada tim dan ajak menetapkan komitmen bersama.',
        'Tetapkan indikator keberhasilan dan tanggal evaluasi 30 hari.',
      ],
    },
  ]

  return { result, dimensions, strengths, priorities, overall, category, plan }
}
