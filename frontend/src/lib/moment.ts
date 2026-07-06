import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// "Moment of Recognition" — a host-triggered in-call celebration broadcast to
// every participant over LiveKit's data channel (same transport as chat /
// reactions). The host picks a person + reason in the composer; the resolved
// Moment is sent on TOPIC_MOMENT and each client plays MomentOverlay once.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC_MOMENT = 'moment'

export type MomentPreset = 'rank' | 'applause' | 'welcome'
export type MomentAccent = 'medal' | 'burst' | 'ripple'

export interface Moment {
  id: string
  name: string // who is being honoured
  label: string // eyebrow, e.g. "NEW RANK"
  sub: string // one-line detail, e.g. "Promoted to Director · congratulations!"
  preset: MomentPreset
  accent: MomentAccent
  emoji?: string
}

// Animation lifecycle (ms) — kept in sync between the overlay and the hook's
// fallback auto-clear. in → hold → out ≈ 6s, one-shot (the card holds on screen).
export const MO_IN = 720
export const MO_HOLD = 4500
export const MO_OUT = 800
export const MO_TOTAL = MO_IN + MO_HOLD + MO_OUT

// Per-preset confetti intensity + palette (CSS custom-property colours, so they
// track the theme). Rank-up carries the fullest energy incl. the gold accent.
export const PRESET: Record<MomentPreset, { count: number; palette: string[] }> = {
  rank: { count: 46, palette: ['var(--coral)', 'var(--mo-gold)', 'var(--teal)', 'var(--teal-soft)', '#ffffff'] },
  applause: { count: 34, palette: ['var(--teal)', 'var(--teal-soft)', 'var(--coral)', '#ffffff'] },
  welcome: { count: 28, palette: ['var(--coral)', 'var(--teal)', 'var(--teal-soft)', '#ffffff'] },
}

export interface ReasonDef {
  key: string
  chipLabel: string
  label: string
  preset: MomentPreset
  accent: MomentAccent
  emoji: string
  detail?: { lbl: string; type: 'select' | 'text'; options?: string[]; def: string; placeholder?: string }
  sub: (detail: string) => string
}

// Coral Club's own recognition moments. Each reason maps to a visual preset, so
// the host picks a *reason*, never an "animation style".
export const REASONS: ReasonDef[] = [
  {
    key: 'welcome', chipLabel: 'Welcome', label: 'WELCOME', preset: 'welcome', accent: 'ripple', emoji: '🎉',
    sub: () => 'Just joined Coral Club — say hi!',
  },
]

/** Receives + broadcasts recognition moments over the data channel. */
export function useMoments(room: Room) {
  const [active, setActive] = useState<Moment | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = (m: Moment) => {
    if (timer.current) window.clearTimeout(timer.current)
    setActive(m)
    // Fallback clear in case the overlay's onDone never fires (e.g. tab hidden).
    timer.current = window.setTimeout(() => setActive(null), MO_TOTAL + 1200)
  }
  const dismiss = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setActive(null)
  }

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC_MOMENT) return
      try {
        const m = JSON.parse(decoder.decode(payload)) as Moment
        if (m && m.name && m.preset) show(m)
      } catch {
        // ignore malformed payloads
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  const celebrate = async (m: Omit<Moment, 'id'>) => {
    const full: Moment = { ...m, id: `${room.localParticipant.identity}-${Date.now()}` }
    try {
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(full)), { reliable: true, topic: TOPIC_MOMENT })
    } catch {
      // still show locally even if the broadcast fails
    }
    show(full)
  }

  return { active, celebrate, dismiss }
}
