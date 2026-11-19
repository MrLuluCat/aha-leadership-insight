export const fmt = (n) =>
  Number(n ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const dfmt = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '—'

export const tfmt = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const time = dt.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return time.replace(/\./g, ':')
}

export const dtfmt = (d) =>
  d ? `${dfmt(d)} · ${tfmt(d)}` : '—'

export const pct = (n) => `${fmt(n)}%`
