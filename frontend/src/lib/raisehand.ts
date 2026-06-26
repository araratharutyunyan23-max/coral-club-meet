import { useEffect, useRef } from 'react'
import { type Participant, type Room, RoomEvent } from 'livekit-client'
import { useRoomEvents } from './hooks'

// Raise-hand ordering. The `handRaised` participant attribute stores the
// timestamp (ms) the hand went up, or '' when lowered — so we can show a queue
// position (1, 2, 3…) and chime when a new hand goes up.

/** Timestamp (ms) a participant raised their hand, or null if their hand is down. */
export function handRaisedAt(p: Participant): number | null {
  const v = p.attributes?.handRaised
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Raised hands, oldest-first (the queue order). */
export function raisedHandQueue(participants: Participant[]): Participant[] {
  return participants
    .filter((p) => handRaisedAt(p) !== null)
    .sort((a, b) => handRaisedAt(a)! - handRaisedAt(b)!)
}

/** 1-based queue position of this participant's raised hand, or null if down. */
export function raiseRank(room: Room, p: Participant): number | null {
  if (handRaisedAt(p) === null) return null
  const all = [room.localParticipant, ...room.remoteParticipants.values()]
  const idx = raisedHandQueue(all).findIndex((x) => x.identity === p.identity)
  return idx >= 0 ? idx + 1 : null
}

const RAISE_EVENTS = [
  RoomEvent.ParticipantAttributesChanged,
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
] as const

/** Plays a gentle two-note chime whenever a new hand goes up (anyone's). */
export function useRaiseHandChime(room: Room): void {
  useRoomEvents(room, RAISE_EVENTS)
  const all = [room.localParticipant, ...room.remoteParticipants.values()]
  const raisedKey = all
    .filter((p) => handRaisedAt(p) !== null)
    .map((p) => p.identity)
    .sort()
    .join(',')
  const prev = useRef<string | null>(null)

  useEffect(() => {
    const prevSet = new Set((prev.current ?? '').split(',').filter(Boolean))
    const current = raisedKey.split(',').filter(Boolean)
    // Don't chime on first mount (pre-existing raised hands) — only on growth.
    const grew = prev.current !== null && current.some((id) => !prevSet.has(id))
    prev.current = raisedKey
    if (grew) playChime()
  }, [raisedKey])
}

function playChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = now + i * 0.12
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.13, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
      osc.start(t)
      osc.stop(t + 0.5)
    })
    window.setTimeout(() => ctx.close().catch(() => {}), 1200)
  } catch {
    /* audio unavailable — silent */
  }
}
