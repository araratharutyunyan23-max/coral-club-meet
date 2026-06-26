import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Backstage / live state for webinars, shared over the data channel. Because
// data messages aren't replayed to late joiners, non-hosts start "not live" and
// request the current state on join; the host answers. The host toggle also
// broadcasts to everyone.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC = 'webinar'

type Msg = { type: 'state'; live: boolean } | { type: 'request'; from: string }

export function useWebinarLive(room: Room, isHost: boolean): { live: boolean; setLive: (v: boolean) => void } {
  // Host is live by default; viewers wait for the host's answer so they can't
  // bypass Backstage by joining late.
  const [live, setLiveState] = useState(isHost)
  const liveRef = useRef(live)
  liveRef.current = live

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const msg = JSON.parse(decoder.decode(payload)) as Msg
        if (msg.type === 'state') {
          setLiveState(msg.live)
        } else if (msg.type === 'request' && isHost) {
          void room.localParticipant.publishData(
            encoder.encode(JSON.stringify({ type: 'state', live: liveRef.current })),
            { reliable: true, topic: TOPIC, destinationIdentities: [msg.from] },
          )
        }
      } catch {
        // ignore
      }
    }
    room.on(RoomEvent.DataReceived, onData)

    // Non-hosts ask the host for the current live/backstage state on join.
    if (!isHost) {
      void room.localParticipant.publishData(
        encoder.encode(JSON.stringify({ type: 'request', from: room.localParticipant.identity })),
        { reliable: true, topic: TOPIC },
      )
    }

    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, isHost])

  const setLive = (next: boolean) => {
    setLiveState(next)
    void room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'state', live: next })), { reliable: true, topic: TOPIC })
  }

  return { live, setLive }
}
