/** Derives up-to-two-letter initials from a display name. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Circular initials avatar shown when a participant's camera is off. */
export function Avatar({ name, size = 62 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--teal-tint)',
        border: '1px solid rgba(37, 208, 192, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.32),
        fontWeight: 600,
        color: 'var(--teal-soft)',
      }}
    >
      {initialsFor(name)}
    </div>
  )
}
