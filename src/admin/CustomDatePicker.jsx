import { useEffect, useRef, useState } from 'react'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function parseYmd(val) {
  if (!val) return null
  const [y, m, d] = val.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m: m - 1, d }
}

function toYmd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDisplay(val, placeholder) {
  const p = parseYmd(val)
  if (!p) return placeholder
  return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}/${p.y}`
}

export default function CustomDatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  ariaLabel,
  alignRight = false,
}) {
  const now = new Date()
  const parsed = parseYmd(value)
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.y ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? now.getMonth())
  const rootRef = useRef(null)

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.y)
      setViewMonth(parsed.m)
    }
  }, [value])

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function stepMonth(delta) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d)

  const todayYmd = toYmd(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div
      ref={rootRef}
      className={`cdp-wrap ${open ? 'is-open' : ''} ${alignRight ? 'cdp-right' : ''}`}
    >
      <button
        type="button"
        className={`cdp-trigger ${value ? 'has-val' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{formatDisplay(value, placeholder)}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="cdp-pop" role="dialog" aria-label={ariaLabel}>
          <div className="cdp-head">
            <strong className="cdp-title">
              {MONTHS[viewMonth]} {viewYear}
            </strong>
            <div className="cdp-nav">
              <button type="button" className="cdp-nav-btn" onClick={() => stepMonth(-1)} aria-label="Bulan sebelumnya">
                ‹
              </button>
              <button type="button" className="cdp-nav-btn" onClick={() => stepMonth(1)} aria-label="Bulan berikutnya">
                ›
              </button>
            </div>
          </div>

          <div className="cdp-grid cdp-weekdays">
            {DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="cdp-grid cdp-days">
            {cells.map((d, idx) => {
              if (!d) return <span key={`e-${idx}`} />
              const ymd = toYmd(viewYear, viewMonth, d)
              const isSelected = ymd === value
              const isToday = ymd === todayYmd
              return (
                <button
                  key={ymd}
                  type="button"
                  className={`cdp-day ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                  onClick={() => {
                    onChange(ymd)
                    setOpen(false)
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="cdp-foot">
            <button
              type="button"
              className="cdp-action"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Hapus
            </button>
            <button
              type="button"
              className="cdp-action"
              onClick={() => {
                onChange(todayYmd)
                setOpen(false)
              }}
            >
              Hari ini
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
