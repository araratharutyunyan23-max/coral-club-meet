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
    // A soft, mellow rising "woop": a triangle wave that glides up in pitch,
    // with a faint sub-octave underneath for warmth. Deliberately different in
    // both timbre (triangle vs sine) and shape (one gliding gesture vs two
    // discrete beeps) from the raise-hand chime, so the two are easy to tell
    // apart by ear.
    const voice = (type: OscillatorType, from: number, to: number, peak: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(from, now)
      osc.frequency.exponentialRampToValueAtTime(to, now + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.55)
    }
    voice('triangle', 440, 659.25, 0.13) // A4 → E5, the body of the tone
    voice('sine', 220, 329.63, 0.05) // sub-octave for warmth
    window.setTimeout(() => ctx.close().catch(() => {}), 1200)
  } catch {
    /* audio unavailable — silent */
  }
}
