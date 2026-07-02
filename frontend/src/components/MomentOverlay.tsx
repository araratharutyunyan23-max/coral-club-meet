import { useEffect, useRef } from 'react'
import { initialsFor, userColor } from './Avatar'
import { type Moment, type MomentAccent, MO_HOLD, MO_IN, MO_OUT, PRESET } from '../lib/moment'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Accent glyph for the avatar badge (monoline, matches the system icon set). */
function AccentIcon({ kind }: { kind: MomentAccent }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'medal' && (
        <>
          <path d="M8.5 3 6.5 8" />
          <path d="M15.5 3 17.5 8" />
          <circle cx="12" cy="15" r="6" />
          <path d="M9.6 15.2 11.2 16.8 14.4 13.6" />
        </>
      )}
      {kind === 'burst' && (
        <>
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 3.2v3M12 17.8v3M3.2 12h3M17.8 12h3M5.7 5.7l2.1 2.1M16.2 16.2l2.1 2.1M18.3 5.7l-2.1 2.1M7.8 16.2l-2.1 2.1" />
        </>
      )}
      {kind === 'ripple' && (
        <>
          <circle cx="7.5" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <path d="M11.5 8a6 6 0 0 1 0 8" />
          <path d="M15 5a11 11 0 0 1 0 14" />
        </>
      )}
    </svg>
  )
}

/** Fill the confetti layer with brand-palette pieces (skipped under reduced motion). */
function spawnConfetti(host: HTMLDivElement | null, preset: Moment['preset']) {
  if (!host) return
  host.innerHTML = ''
  const { count, palette } = PRESET[preset]
  const W = host.clientWidth || 600
  const shapes = ['', '', 'tri', 'ring']
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i')
    const shape = shapes[(Math.random() * shapes.length) | 0]
    el.className = 'cf' + (shape ? ' ' + shape : '')
    const color = palette[(Math.random() * palette.length) | 0]
    el.style.left = 12 + Math.random() * 76 + '%'
    el.style.top = 6 + Math.random() * 22 + '%'
    if (shape === 'tri') el.style.borderBottomColor = color
    else if (shape === 'ring') el.style.color = color
    else {
      el.style.background = color
      el.style.height = 10 + Math.random() * 8 + 'px'
    }
    el.style.setProperty('--cf-x', (((Math.random() * 2 - 1) * W * 0.16) | 0) + 'px')
    el.style.setProperty('--cf-fall', (((W * 0.42) + Math.random() * W * 0.22) | 0) + 'px')
    el.style.setProperty('--cf-rot', (((Math.random() * 2 - 1) * 720) | 0) + 'deg')
    el.style.setProperty('--cf-dur', (2.2 + Math.random() * 1.4).toFixed(2) + 's')
    el.style.setProperty('--cf-delay', (Math.random() * 0.5).toFixed(2) + 's')
    host.appendChild(el)
  }
}

/**
 * The celebration everyone sees: a coral Signal-Field bloom + confetti + a glass
 * card naming the honoured person. Plays once (~3.5s) then calls onDone. Reads
 * over the live call (pointer-events:none); reduced motion → static card.
 */
export function MomentOverlay({ moment, onDone }: { moment: Moment; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const confettiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rm = prefersReducedMotion()
    const hold = rm ? 2600 : MO_HOLD
    if (rm) el.classList.add('rm')
    // show first so the confetti layer has a real width to spread across; then
    // play on the same tick — the browser paints show+play together (no flash).
    el.classList.add('show')
    if (!rm) spawnConfetti(confettiRef.current, moment.preset)
    el.classList.add('play')

    const timers: number[] = []
    if (!rm) timers.push(window.setTimeout(() => el.classList.add('rested'), MO_IN + 130))
    timers.push(window.setTimeout(() => {
      // drop 'play' too: otherwise the entrance keyframes (still in the cascade)
      // re-fire from 0% when 'rested' is removed, replacing the graceful fade
      // with a jarring re-entrance. Without 'play', base styles hold the card
      // visible and the '.leaving' transition fades it out.
      el.classList.remove('rested', 'play')
      el.classList.add('leaving')
    }, MO_IN + hold))
    timers.push(window.setTimeout(onDone, MO_IN + hold + MO_OUT))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment.id])

  return (
    <div ref={ref} className="moment" aria-live="polite">
      <div className="mo-veil" />
      <div className="mo-bloom"><span /><span /><span /></div>
      <div className="mo-confetti" ref={confettiRef} />
      <div className="mo-card">
        <div className="mo-av">
          {moment.emoji && <span className="mo-emoji">{moment.emoji}</span>}
          <div className="disc" style={{ background: userColor(moment.name, true) }}>{initialsFor(moment.name)}</div>
          <div className="mo-badge"><AccentIcon kind={moment.accent} /></div>
        </div>
        <div className="mo-label">{moment.label}</div>
        <h2 className="mo-name">{moment.name}</h2>
        <p className="mo-sub">{moment.sub}</p>
      </div>
    </div>
  )
}
