import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Host → participant moderation notifications over the data channel. The actual
// enforcement (muting, removing) happens server-side via the backend RoomService;
// this channel just lets the affected user know what happened.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC = 'moderation'

export type ModerationAction = 'muted'

/** Sent by a host's client (alongside the backend action) to notify the target. */
export async function notifyModeration(room: Room, action: ModerationAction, targetIdentity: string) {
  await room.localParticipant.publishData(encoder.encode(JSON.stringify({ action, target: targetIdentity })), {
    reliable: true,
    topic: TOPIC,
    destinationIdentities: [targetIdentity],
  })
}

/** True for a few seconds after the local user is muted by a host. */
export function useMutedByHost(room: Room): boolean {
  const [muted, setMuted] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const { action, target } = JSON.parse(decoder.decode(payload)) as { action: ModerationAction; target: string }
        if (action === 'muted' && target === room.localParticipant.identity) {
          setMuted(true)
          if (timer.current !== null) clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setMuted(false), 4000)
        }
      } catch {
        // ignore
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [room])

  return muted
}
