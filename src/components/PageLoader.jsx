export default function PageLoader({ variant = 'page', label = 'Memuat halaman…' }) {
  if (variant === 'admin') {
    return (
      <div className="sk-wrap" role="status" aria-live="polite" aria-label={label}>
        <div className="sk-head">
          <div className="sk-stack">
            <div className="sk-line sk-w-40 sk-h-lg" />
            <div className="sk-line sk-w-70" />
          </div>
          <div className="sk-pill" />
        </div>
        <div className="sk-card">
          <div className="sk-toolbar">
            <div className="sk-box sk-grow" />
            <div className="sk-box sk-w-160" />
            <div className="sk-box sk-w-160" />
          </div>
          <div className="sk-rows">
            <div className="sk-row" />
            <div className="sk-row" />
            <div className="sk-row" />
            <div className="sk-row" />
            <div className="sk-row" />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'report') {
    return (
      <div className="sk-page" role="status" aria-live="polite" aria-label={label}>
        <div className="sk-nav">
          <div className="sk-box sk-w-140" />
          <div className="sk-pill" />
        </div>
        <div className="sk-body">
          <div className="sk-line sk-w-30 sk-h-lg" />
          <div className="sk-grid-3">
            <div className="sk-card sk-h-220" />
            <div className="sk-card sk-h-220" />
            <div className="sk-card sk-h-220" />
          </div>
          <div className="sk-grid-2">
            <div className="sk-card sk-h-160" />
            <div className="sk-card sk-h-160" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sk-splash" role="status" aria-live="polite" aria-label={label}>
      <div className="sk-spinner" aria-hidden="true" />
      <p className="meta">{label}</p>
    </div>
  )
}
