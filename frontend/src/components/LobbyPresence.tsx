import { useEffect, useRef, useState } from 'react'
import { fetchPresence } from '../lib/api'
import { useT } from '../lib/i18n'

// Faceless tinted circles (Direction B): warmth + a sense of room size, no identity.
// Hue palette is by POSITION, not by person — the circles reveal nothing about who.
const HUES = [162, 228, 42, 300, 274, 16, 194, 330, 110, 250]
const POLL_MS = 5000

/**
 * Pre-join presence — a live read of how many people are already in the room,
 * shown on the lobby before you join. Count + up to 4 anonymous tinted circles
 * (+more), capped at "9+"; an empty room leans on the brand ("you'll be first").
 */
export function LobbyPresence({ room }: { room: string }) {
  const t = useT()
  const [count, setCount] = useState<number | null>(null)
  const rollRef = useRef<HTMLSpanElement>(null)
  const prev = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const n = await fetchPresence(room)
      if (!cancelled) setCount(n)
    }
    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [room])

  // Gently bump the number whenever it changes (not on first load).
  useEffect(() => {
    if (count == null) return
    if (prev.current != null && prev.current !== count && rollRef.current) {
      const el = rollRef.current
      el.classList.remove('lp-bump')
      void el.offsetWidth // restart the animation
      el.classList.add('lp-bump')
    }
    prev.current = count
  }, [count])

  return (
    <div className="lobby-presrow">
      {count == null ? (
        <span className="lobby-presence" aria-hidden="true">
          <span className="lp-dot" />
        </span>
      ) : count === 0 ? (
        <span className="lobby-presence" data-empty="" aria-live="polite">
          <span className="lp-emark" aria-hidden="true">
            <i />
            <i />
            <i />
            <span className="lp-c" />
          </span>
          <span className="lp-etext">{t("You'll be the first here")}</span>
        </span>
      ) : (
        <span className="lobby-presence" aria-live="polite">
          <span className="lp-dot" aria-hidden="true" />
          <span className="lp-stack" aria-hidden="true">
            {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
              <span key={i} className="lp-av" style={{ background: `hsl(${HUES[i % HUES.length]} 54% 47%)` }} />
            ))}
            {count > 4 && <span className="lp-av lp-more">+</span>}
          </span>
          <span className="lp-count">
            <span ref={rollRef} className="lp-roll">
              {count > 9 ? '9+' : count}
            </span>{' '}
            <span className="lp-u">{t('in the call')}</span>
          </span>
        </span>
      )}
    </div>
  )
}
