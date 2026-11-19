const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
}

const paths = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" />,
  results: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  questions: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6M12 16.9v.1" />
    </>
  ),
  dimensions: (
    <>
      <path d="M4 7h10M4 12h16M4 17h8" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  versions: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.4-3 2.8-5 6-5s5.6 2 6 5" />
      <path d="M16 5.6a3 3 0 0 1 0 5.8M18 14.8c1.8.6 3 2.2 3.3 4.7" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16.2 9.5" />
    </>
  ),
  index: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </>
  ),
  up: <path d="M4 16 10 10l4 4 6-7M15 7h5v5" />,
  down: <path d="M4 8l6 6 4-4 6 7M15 17h5v-5" />,
  pie: (
    <>
      <path d="M12 3v9h9a9 9 0 0 0-9-9Z" />
      <path d="M20.2 15A9 9 0 1 1 9 3.8" />
    </>
  ),
  trend: <path d="M3 17 9 11l4 4 8-9M15 6h6v6" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.5a2.5 2.5 0 0 0 2.5 4.5M16 6h2.5a2.5 2.5 0 0 1-2.5 4.5M12 13v3M9 20h6M10 16h4l1 4H9l1-4Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 1.9v.2h5v-.2c0-.7.4-1.4 1-1.9A6 6 0 0 0 12 3Z" />
    </>
  ),
  bars: <path d="M5 20V11M12 20V4M19 20v-6M3 20h18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18M6 6l12 12" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.5 8 6 8-6" />
    </>
  ),
}

export default function Icon({ name, size = 20 }) {
  return (
    <svg {...base} width={size} height={size}>
      {paths[name]}
    </svg>
  )
}
