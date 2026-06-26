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
    // A warm rising perfect fifth (C5 → G5) — friendlier and distinct from the
    // brighter raise-hand chime so the two are easy to tell apart.
    ;[523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = now + i * 0.14
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.45)
    })
    window.setTimeout(() => ctx.close().catch(() => {}), 1200)
  } catch {
    /* audio unavailable — silent */
  }
}
