import { Fragment, type CSSProperties } from 'react'
import type { Reaction } from '../lib/datachannel'

const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * In-call reactions — Signal-Field styled. Each reaction emits a coral/teal
 * ripple bloom at its origin and rises with a soft glow trail in the sender's
 * own hue, its name set in a glass pill ("You" for the local sender). The layer
 * is pointer-events:none and sits below the control bar, so it reads over the
 * video but never blocks a control. Under reduced motion it fades in place.
 */
export function ReactionsOverlay({ active }: { active: Reaction[] }) {
  const rm = prefersReduced()
  return (
    <div
      className={rm ? 'rx-layer rm' : 'rx-layer'}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}
      aria-hidden="true"
    >
      {active.map((r) => {
        const style = {
          left: `${r.x}%`,
          bottom: r.y,
          '--hue': r.hue,
          '--rise': `${r.rise}px`,
          '--sway': `${r.sway}px`,
          '--dur': `${r.dur}s`,
        } as CSSProperties
        return (
          <Fragment key={r.id}>
            {!rm && (
              <div className="rx-bloomslot" style={style} aria-hidden="true">
                <span />
                <span />
              </div>
            )}
            <div className="rx-slot" style={style}>
              {!rm && <div className="rx-glow" aria-hidden="true" />}
              <div className="rx-emoji">{r.emoji}</div>
              <div className="rx-name">
                <span className="rx-dot" />
                <b>{r.label}</b>
              </div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
