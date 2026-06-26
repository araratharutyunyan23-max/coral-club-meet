/** The "Ripple" mark — concentric teal arcs radiating from a coral core.
 *  Doubles as the seed of the in-product motion language (loaders, speaking).
 *  Colors are the designer's placeholders; swap the two gradient stops + coral
 *  when the official Coral Club hex arrives. */
export function RippleMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ flex: '0 0 auto' }} aria-hidden>
      <defs>
        <linearGradient id="ccRipple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34e6d3" />
          <stop offset="1" stopColor="#0f9c8d" />
        </linearGradient>
      </defs>
      <g stroke="url(#ccRipple)" fill="none" strokeWidth={3.4} strokeLinecap="round">
        <path d="M30 9a21 21 0 0 1 0 42" />
        <path d="M30 19a11 11 0 0 1 0 22" />
      </g>
      <circle cx="30" cy="30" r="4.4" fill="#ff7e63" />
    </svg>
  )
}

/** Coral Club Meet wordmark + Ripple mark. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <RippleMark size={size} />
      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.01em' }}>
        Coral Club <span style={{ color: 'var(--text-mute)', fontWeight: 500 }}>Meet</span>
      </div>
    </div>
  )
}
