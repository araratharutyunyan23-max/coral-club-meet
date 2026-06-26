import type { CSSProperties } from 'react'
import type { Reaction } from '../lib/datachannel'

/** Floating reactions that rise from random spots over the stage and fade out. */
export function ReactionsOverlay({ active }: { active: Reaction[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {active.map((r) => (
        <div
          key={r.id}
          style={
            {
              position: 'absolute',
              bottom: 84,
              left: `${r.x}%`,
              '--drift': `${r.drift}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              animation: `floatreact ${r.dur}s ease-out forwards`,
              willChange: 'transform, opacity',
            } as CSSProperties
          }
        >
          <span style={{ fontSize: 32, filter: 'drop-shadow(0 6px 12px rgba(255, 126, 99, 0.45))' }}>{r.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', textShadow: '0 1px 4px var(--surround)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
        </div>
      ))}
    </div>
  )
}
