import { useEffect, useReducer, useRef, useState } from 'react'
import { BackgroundBlur } from '@livekit/track-processors'
import { KrispNoiseFilter, isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter'
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
        await r.localParticipant.setMicrophoneEnabled(
          join.audioEnabled,
          join.audioDeviceId ? { deviceId: join.audioDeviceId } : undefined,
        )
        await r.localParticipant.setCameraEnabled(
          join.videoEnabled,
          join.videoDeviceId ? { deviceId: join.videoDeviceId } : undefined,
        )
        if (join.blur && join.videoEnabled) {
          // Best-effort: loads an ML segmentation model; silently skip if unavailable.
          await applyBackgroundBlur(r).catch(() => {})
        }
        if (join.speakerDeviceId) {
          await r.switchActiveDevice('audiooutput', join.speakerDeviceId).catch(() => {})
        }
        if (join.krisp !== false && join.audioEnabled) {
          // Krisp AI noise cancellation, on by default. Loads a model; falls back
          // to the browser's noise suppression if unsupported/unavailable.
          await applyNoiseFilter(r).catch(() => {})
        }
        setRoom(r)
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

const QUALITY_EVENTS = [RoomEvent.ConnectionQualityChanged] as const

/** Live connection quality for the local participant. */
export function useConnectionQuality(room: Room): ConnectionQuality {
  useRoomEvents(room, QUALITY_EVENTS)
  return room.localParticipant.connectionQuality
}

async function applyBackgroundBlur(room: Room) {
  const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined
  if (track) await track.setProcessor(BackgroundBlur(10))
}

async function applyNoiseFilter(room: Room) {
  if (!isKrispNoiseFilterSupported()) return
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined
  if (track) await track.setProcessor(KrispNoiseFilter())
}
