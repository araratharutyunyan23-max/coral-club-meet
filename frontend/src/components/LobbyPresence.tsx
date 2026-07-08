import { useEffect, useRef, useState } from 'react'
import { fetchPresence, type Presence } from '../lib/api'
import { initialsFor, userTint } from './Avatar'
import { useT } from '../lib/i18n'

const POLL_MS = 5000

/**
 * Pre-join presence — a live read of who's already in the room, shown on the
 * lobby before you join. Up to 4 circles with initials + a per-person hue
 * (matching the in-call avatars), the total count capped at "9+", and an empty
 * room that leans on the brand ("you'll be first"). Updates every few seconds.
 */
export function LobbyPresence({ room }: { room: string }) {
  const t = useT()
  const [data, setData] = useState<Presence | null>(null)
  const rollRef = useRef<HTMLSpanElement>(null)
  const prev = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const p = await fetchPresence(room)
      if (!cancelled) setData(p)
    }
    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [room])

  // Gently bump the number whenever it changes (not on first load).
  const count = data?.count ?? null
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

  let inner
  if (data == null) {
    inner = (
      <span className="lobby-presence" aria-hidden="true">
        <span className="lp-dot" />
      </span>
    )
  } else if (data.count === 0) {
    inner = (
      <span className="lobby-presence" data-empty="" aria-live="polite">
        <span className="lp-emark" aria-hidden="true">
          <i />
          <i />
          <i />
          <span className="lp-c" />
        </span>
        <span className="lp-etext">{t("You'll be the first here")}</span>
      </span>
    )
  } else {
    const extra = data.count - data.names.length
    inner = (
      <span className="lobby-presence" aria-live="polite">
        <span className="lp-dot" aria-hidden="true" />
        <span className="lp-stack" aria-hidden="true">
          {data.names.slice(0, 4).map((name, i) => (
            <span key={i} className="lp-av" style={userTint(name)}>
              {initialsFor(name)}
            </span>
          ))}
          {extra > 0 && <span className="lp-av lp-more">+{extra > 9 ? '9' : extra}</span>}
        </span>
        <span className="lp-count">
          <span ref={rollRef} className="lp-roll">
            {data.count > 9 ? '9+' : data.count}
          </span>{' '}
          <span className="lp-u">{t('in the call')}</span>
        </span>
      </span>
    )
  }

  return <div className="lobby-presrow">{inner}</div>
}
