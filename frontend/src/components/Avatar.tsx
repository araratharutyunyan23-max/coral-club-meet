import type { CSSProperties } from 'react'

/** Derives up-to-two-letter initials from a display name. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Curated, evenly-spread hues that all read well once mixed into the surface —
// warm reds/corals, amber, greens, teals, blues, indigo, violet, magenta, pink.
// (Muddy yellow-greens are skipped.) Each participant gets one deterministically,
// so their colour is stable and the same everywhere they appear.
const AVATAR_HUES = [4, 16, 28, 42, 140, 162, 178, 194, 210, 228, 250, 274, 300, 330]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  return h
}

/** Deterministic, pleasant hue (0–359) for a participant, keyed on their name. */
export function hueFor(key: string): number {
  return AVATAR_HUES[hashString(key || '?') % AVATAR_HUES.length]
}

/**
 * Per-participant tint for a circular initials avatar. Colours are mixed into the
 * theme's --surface / --text, so they stay legible and on-tone in both themes.
 * `strong` gives the big camera-off avatars more presence than the small roster ones.
 */
export function userTint(key: string, strong = false): CSSProperties {
  const c = `hsl(${hueFor(key)} 62% 52%)`
  const bg = strong ? 40 : 26
  const bd = strong ? 58 : 44
  return {
    background: `color-mix(in srgb, ${c} ${bg}%, var(--surface))`,
    border: `1px solid color-mix(in srgb, ${c} ${bd}%, transparent)`,
    color: `color-mix(in srgb, ${c} 74%, var(--text))`,
  }
}

/** A soft, tile-wide colour wash for a participant's camera-off tile (Kontur-style). */
export function tileTint(key: string): string {
  const h = hueFor(key)
  return (
    `radial-gradient(120% 115% at 50% 32%, ` +
    `color-mix(in srgb, hsl(${h} 58% 50%) 26%, var(--surface)), ` +
    `color-mix(in srgb, hsl(${h} 55% 42%) 12%, var(--surface)))`
  )
}

/** Circular initials avatar shown when a participant's camera is off. */
export function Avatar({ name, size = 62 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.32),
        fontWeight: 600,
        ...userTint(name, true),
      }}
    >
      {initialsFor(name)}
    </div>
  )
}
