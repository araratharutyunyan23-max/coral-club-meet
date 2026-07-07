import { useEffect, useReducer, useRef, useState } from 'react'
import {
  AudioPresets,
  ConnectionQuality,
  ConnectionState,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type Participant,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client'
import type { JoinInfo } from './types'

/** Re-renders the calling component whenever any of the given room events fire. */
export function useRoomEvents(room: Room, events: readonly RoomEvent[]): void {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    events.forEach((e) => room.on(e, bump))
    return () => {
      events.forEach((e) => room.off(e, bump))
    }
  }, [room, events])
}

const PARTICIPANT_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.TrackPublished,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.ParticipantAttributesChanged,
  RoomEvent.ParticipantPermissionsChanged,
] as const

/** Returns the live participant list (local participant first). */
export function useParticipants(room: Room): Participant[] {
  useRoomEvents(room, PARTICIPANT_EVENTS)
  return [room.localParticipant, ...room.remoteParticipants.values()]
}

/** Whether a participant may publish media (presenter vs view-only audience). */
export function canPublish(p: Participant): boolean {
  return p.permissions?.canPublish ?? true
}

const ACTIVE_SPEAKER_EVENTS = [
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
] as const

/** Returns the current dominant speaker (falls back to the local participant). */
export function useActiveSpeaker(room: Room): Participant {
  useRoomEvents(room, ACTIVE_SPEAKER_EVENTS)
  // Guard against a stale active-speaker entry for someone who just left.
  const live = new Set<Participant>([room.localParticipant, ...room.remoteParticipants.values()])
  return room.activeSpeakers.find((s) => live.has(s)) ?? room.localParticipant
}

interface Connection {
  room: Room | null
  state: ConnectionState
  error: string | null
}

/**
 * Creates a Room, connects with the given token, applies the chosen initial
 * device state, and disconnects on unmount.
 */
export function useRoomConnection(join: JoinInfo, onLeave: () => void): Connection {
  const [room, setRoom] = useState<Room | null>(null)
  const [state, setState] = useState<ConnectionState>(ConnectionState.Connecting)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // guard against re-entry
    started.current = true

    const r = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Audio quality tuned toward Zoom-like clarity: music-grade Opus, RED
      // (redundant encoding) for packet-loss resilience, DTX to save bandwidth
      // in silence, plus the browser's own echo/noise/gain processing.
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      publishDefaults: {
        audioPreset: AudioPresets.music,
        dtx: true,
        red: true,
      },
    })
    const handleState = (s: ConnectionState) => setState(s)
    const handleDisconnect = () => onLeave()
    r.on(RoomEvent.ConnectionStateChanged, handleState)
    r.on(RoomEvent.Disconnected, handleDisconnect)

    void (async () => {
      try {
        await r.connect(join.url, join.token)
        // Publish mic + camera in parallel and show the room as soon as the user
        // is connected and publishing — don't make them stare at the spinner.
        await Promise.all([
          r.localParticipant.setMicrophoneEnabled(
            join.audioEnabled,
            join.audioDeviceId ? { deviceId: join.audioDeviceId } : undefined,
          ),
          r.localParticipant.setCameraEnabled(
            join.videoEnabled,
            join.videoDeviceId ? { deviceId: join.videoDeviceId } : undefined,
          ),
        ])
        setRoom(r)

        // Best-effort enhancements, applied to the already-live tracks AFTER the
        // room renders so they never gate entry (the processor swaps transparently;
        // Krisp's model / blur's segmenter just turn on a beat later).
        if (join.speakerDeviceId) void r.switchActiveDevice('audiooutput', join.speakerDeviceId).catch(() => {})
        if (join.krisp !== false && join.audioEnabled) void applyNoiseFilter(r).catch(() => {})
        if (join.blur && join.videoEnabled) void applyBackgroundBlur(r).catch(() => {})
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not connect to the call')
      }
    })()

    return () => {
      // Detach our listeners before disconnecting so the cleanup-triggered
      // Disconnected event does not call onLeave during unmount.
      r.off(RoomEvent.ConnectionStateChanged, handleState)
      r.off(RoomEvent.Disconnected, handleDisconnect)
      void r.disconnect()
    }
    // join/onLeave are stable for the lifetime of a single call.
  }, [])

  return { room, state, error }
}

/**
 * True when the viewport is phone-sized (narrower than `breakpoint`, default
 * 768px). Reactive to resize and orientation changes — components call this
 * directly to switch to their mobile layout (no prop threading).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint)
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [breakpoint])
  return mobile
}

/**
 * Fraction to scale a fixed-width element by so it fits narrow phones:
 * clamp(min, (innerWidth - pad) / naturalWidth, 1) — 1 on roomy screens,
 * shrinking to `min` on very narrow ones. Reactive to resize. Computed in JS
 * because CSS cannot divide a length by a length to yield a unitless scale
 * (a `scale(clamp(0.8, calc(100vw/384), 1))` would be type-invalid and dropped).
 */
export function useFitScale(naturalWidth: number, pad = 14, min = 0.8): number {
  const compute = () =>
    typeof window === 'undefined' ? 1 : Math.max(min, Math.min(1, (window.innerWidth - pad) / naturalWidth))
  const [scale, setScale] = useState(compute)
  useEffect(() => {
    const onResize = () => setScale(compute())
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalWidth, pad, min])
  return scale
}

/** True when the viewport is taller than it is wide (portrait). Reactive. */
export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(() => typeof window !== 'undefined' && window.innerHeight >= window.innerWidth)
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight >= window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
  return portrait
}

const QUALITY_EVENTS = [RoomEvent.ConnectionQualityChanged] as const

/** Live connection quality for the local participant. */
export function useConnectionQuality(room: Room): ConnectionQuality {
  useRoomEvents(room, QUALITY_EVENTS)
  return room.localParticipant.connectionQuality
}

// These pull in heavy WASM/ML bundles (MediaPipe for blur, a ~6MB Krisp model),
// so they're imported dynamically — they split into their own chunks and are
// only fetched when the feature is actually applied, not on first page load.
async function applyBackgroundBlur(room: Room) {
  const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined
  if (!track) return
  const { BackgroundBlur } = await import('@livekit/track-processors')
  await track.setProcessor(BackgroundBlur(10))
}

async function applyNoiseFilter(room: Room) {
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined
  if (!track) return
  const { KrispNoiseFilter, isKrispNoiseFilterSupported } = await import('@livekit/krisp-noise-filter')
  if (!isKrispNoiseFilterSupported()) return
  await track.setProcessor(KrispNoiseFilter())
}
