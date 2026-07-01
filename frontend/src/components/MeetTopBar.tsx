import { useEffect, useState } from 'react'
import type { Room } from 'livekit-client'
import { RippleMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { HandIcon, PeopleIcon } from '../lib/icons'
import { useParticipants, useIsMobile } from '../lib/hooks'
import { raisedHandQueue } from '../lib/raisehand'
import { initialsFor, userTint } from './Avatar'

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

/** Meeting start = the earliest still-present participant's server-assigned join
 *  time, so every client (including late joiners) shows the same running
 *  duration instead of counting from their own arrival. */
function meetingStartMs(room: Room): number {
  const all = [room.localParticipant, ...room.remoteParticipants.values()]
  const times = all
    .map((p) => p.joinedAt?.getTime())
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0)
  return times.length ? Math.min(...times) : Date.now()
}

/** Live meeting duration (shared across participants), ticking every second. */
function useElapsed(room: Room): string {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return formatElapsed(Date.now() - meetingStartMs(room))
}

/**
 * Minimal Meet-style top line: Ripple mark · "Coral Club" brand · call timer on the
 * left; a participant-count pill with stacked avatars (plus the theme toggle and
 * a REC indicator) on the right. The room code is kept as a hover title on the brand.
 * Flat — no glass.
 */
export function MeetTopBar({ room, roomName, recording = false }: { room: Room; roomName: string; recording?: boolean }) {
  const participants = useParticipants(room)
  const elapsed = useElapsed(room)
  const isMobile = useIsMobile()
  const avatars = participants.slice(0, 3).map((p) => {
    const key = p.name || p.identity
    return { key, initials: initialsFor(key) }
  })
  // Raised hands (oldest first) → show the first raiser in the top bar.
  const raised = raisedHandQueue(participants)
  const firstRaiser = raised[0]
  const raiserName = firstRaiser ? (firstRaiser === room.localParticipant ? 'You' : firstRaiser.name || firstRaiser.identity) : ''
  const extraHands = raised.length - 1

  return (
    <header style={{ height: 56, flex: '0 0 auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 12px' : '0 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 12.5 }}>
        <RippleMark size={19} />
        {!isMobile && <div style={{ width: 1, height: 15, background: 'var(--border-strong)' }} />}
        <span
          title={roomName}
          style={{ fontFamily: 'var(--font)', fontSize: isMobile ? 13.5 : 15, fontWeight: 600, letterSpacing: '.01em', color: 'var(--text)', whiteSpace: 'nowrap' }}
        >
          Coral Club
        </span>
        {recording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4, padding: '3px 9px', background: 'rgba(239,75,67,.13)', border: '1px solid rgba(239,75,67,.3)', borderRadius: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', animation: 'recblink 1.4s infinite' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: '#ff7b73' }}>REC</span>
          </div>
        )}
      </div>

      {/* Call duration, centred in the bar */}
      <span
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--mono)', fontSize: isMobile ? 15 : 17, fontWeight: 500, letterSpacing: '.06em', color: 'var(--text)' }}
        title="Call duration"
      >
        {elapsed}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {firstRaiser && (
          <div
            title={`${raiserName} raised a hand`}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,126,99,.16)', border: '1px solid rgba(255,126,99,.4)', maxWidth: isMobile ? 150 : 320, animation: 'handPop 0.42s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <HandIcon size={15} style={{ color: 'var(--coral)', flex: '0 0 auto', transformOrigin: '62% 88%', animation: 'handWave 1.15s ease-in-out 0.2s 1 both' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {raiserName}
              {!isMobile && ' raised a hand'}
              {extraHands > 0 ? ` +${extraHands}` : ''}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px 7px 16px', borderRadius: 99, background: 'var(--fill-subtle)', border: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>
            <PeopleIcon size={18} style={{ color: 'var(--text-dim)' }} />
            {participants.length}
          </span>
          {!isMobile && <div style={{ display: 'flex', alignItems: 'center' }}>
            {avatars.map((a, i) => (
              <div
                key={i}
                style={{ ...userTint(a.key), width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--surround)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, marginLeft: i === 0 ? 0 : -10 }}
              >
                {a.initials}
              </div>
            ))}
          </div>}
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
