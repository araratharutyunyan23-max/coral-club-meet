import { useEffect, useRef, useState } from 'react'
import type { Room } from 'livekit-client'
import { RippleMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { PeopleIcon } from '../lib/icons'
import { useParticipants } from '../lib/hooks'
import { initialsFor } from './Avatar'

/** Elapsed call time as MM:SS (or H:MM:SS once past an hour). */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Live call duration, ticking every second from when the call UI mounted. */
function useElapsed(): string {
  const start = useRef(Date.now())
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return formatElapsed(Date.now() - start.current)
}

/**
 * Minimal Meet-style top line: Ripple mark · call timer · meeting code · info on the
 * left; a participant-count pill with stacked avatars (plus the theme toggle and
 * a REC indicator) on the right. Flat — no glass.
 */
export function MeetTopBar({ room, roomName, recording = false }: { room: Room; roomName: string; recording?: boolean }) {
  const participants = useParticipants(room)
  const elapsed = useElapsed()
  const avatars = participants.slice(0, 3).map((p) => initialsFor(p.name || p.identity))

  return (
    <header style={{ height: 56, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 12.5 }}>
        <RippleMark size={19} />
        <div style={{ width: 1, height: 15, background: 'var(--border-strong)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text)' }} title="Call duration">{elapsed}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, letterSpacing: '.02em' }}>{roomName}</span>
        {recording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4, padding: '3px 9px', background: 'rgba(239,75,67,.13)', border: '1px solid rgba(239,75,67,.3)', borderRadius: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', animation: 'recblink 1.4s infinite' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: '#ff7b73' }}>REC</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px 7px 16px', borderRadius: 99, background: 'var(--fill-subtle)', border: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>
            <PeopleIcon size={18} style={{ color: 'var(--text-dim)' }} />
            {participants.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {avatars.map((t, i) => (
              <div
                key={i}
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal-tint)', border: '2px solid var(--surround)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--teal-soft)', marginLeft: i === 0 ? 0 : -10 }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
