export const fmt = (n) =>
  Number(n ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const dfmt = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '—'

export const dtfmt = (d) =>
  d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const pct = (n) => `${fmt(n)}%`
