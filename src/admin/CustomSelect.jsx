import { useEffect, useRef, useState } from 'react'

export default function CustomSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Pilih…',
  ariaLabel,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)

  const selected = options.find((opt) => String(opt.value) === String(value))

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function decidePlacement() {
    if (!rootRef.current) return { up: false, right: false }
    const rect = rootRef.current.getBoundingClientRect()
    const estimatedHeight = Math.min(248, options.length * 40 + 16)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const up = spaceBelow < estimatedHeight + 16 && spaceAbove > spaceBelow
    const right = window.innerWidth - rect.left < 240 && rect.right > 200
    return { up, right }
  }

  function toggleOpen() {
    if (disabled) return
    if (!open) {
      const idx = options.findIndex((opt) => String(opt.value) === String(value))
      setActiveIndex(idx >= 0 ? idx : 0)
      const placement = decidePlacement()
      setOpenUp(placement.up)
      setAlignRight(placement.right)
    }
    setOpen((prev) => !prev)
  }

  function selectOption(opt) {
    onChange(opt.value)
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const idx = options.findIndex((opt) => String(opt.value) === String(value))
        setActiveIndex(idx >= 0 ? idx : 0)
        const placement = decidePlacement()
        setOpenUp(placement.up)
        setAlignRight(placement.right)
        setOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(1, options.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + options.length) % Math.max(1, options.length))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (options[activeIndex]) selectOption(options[activeIndex])
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`cs-wrap ${open ? 'is-open' : ''} ${openUp ? 'is-up' : ''} ${alignRight ? 'is-right' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
    >
      <button
        id={id}
        type="button"
        className="cs-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
      >
        <span className="cs-label">{selected ? selected.label : placeholder}</span>
        <svg
          className="cs-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="cs-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value)
            const isActive = idx === activeIndex
            return (
              <li
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                className={`cs-option ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(opt)
                }}
              >
                <span className="cs-opt-text">{opt.label}</span>
                {isSelected && (
                  <svg
                    className="cs-check"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
