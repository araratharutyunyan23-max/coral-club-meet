import type { Reaction } from '../lib/datachannel'

/** Floating reactions that rise over the stage and fade out. */
export function ReactionsOverlay({ active }: { active: Reaction[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {active.map((r, i) => (
        <div
          key={r.id}
          style={{
            position: 'absolute',
            bottom: 92,
            left: '40%',
            // Rise from a bit left of centre with a little horizontal spread.
            // (marginLeft isn't animated, so floatup's transform won't override it.)
            marginLeft: ((i % 5) - 2) * 22 - 17,
            fontSize: 34,
            animation: 'floatup 3.8s ease-out forwards',
            filter: 'drop-shadow(0 6px 12px rgba(255, 126, 99, 0.45))',
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  )
}
