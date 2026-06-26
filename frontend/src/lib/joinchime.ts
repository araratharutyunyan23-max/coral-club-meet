import { useEffect } from 'react'
import { type Room, RoomEvent } from 'livekit-client'

// A soft "someone arrived" chime. ParticipantConnected only fires for people who
// join *after* the local user is in the room, so this never sounds for the
// participants who were already present when we joined — exactly what we want.

/** Plays a gentle ascending chime whenever a new participant joins the call. */
export function useJoinChime(room: Room): void {
  useEffect(() => {
    const onJoin = () => playJoinChime()
    room.on(RoomEvent.ParticipantConnected, onJoin)
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin)
    }
  }, [room])
}

function playJoinChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    // A soft "ding-dong" doorbell: two descending bell notes (E5 → C5), each
    // built from a fundamental plus a couple of partials for a bell-like timbre
    // with a fast attack and long tail. Clearly different from the raise-hand
    // chime and the earlier rising tone, and instantly reads as "someone here".
    const bell = (freq: number, at: number, peak: number) => {
      ;[
        [1, peak],
        [2.01, peak * 0.4],
        [3.0, peak * 0.14],
      ].forEach(([mult, vol]) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq * mult
        osc.connect(gain)
        gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(vol, at + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7)
        osc.start(at)
        osc.stop(at + 0.75)
      })
    }
    bell(659.25, now, 0.12) // "ding" — E5
    bell(523.25, now + 0.2, 0.12) // "dong" — C5
    window.setTimeout(() => ctx.close().catch(() => {}), 1400)
  } catch {
    /* audio unavailable — silent */
  }
}
