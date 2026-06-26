import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'
import { admin } from './api'

// Recording state shared over the data channel (so everyone sees the REC badge),
// with join-time request/reply so late joiners learn the current state. The host
// toggle calls the backend (LiveKit Egress) and reverts optimistically on failure.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC = 'rec'

type Msg = { type: 'state'; active: boolean } | { type: 'request'; from: string }

export function useRecording(room: Room, isHost: boolean): { active: boolean; toggle: () => void } {
  const [active, setActive] = useState(false)
  const activeRef = useRef(active)
  activeRef.current = active

  const broadcast = (a: boolean) =>
    room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'state', active: a })), { reliable: true, topic: TOPIC })

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const msg = JSON.parse(decoder.decode(payload)) as Msg
        if (msg.type === 'state') {
          setActive(msg.active)
        } else if (msg.type === 'request' && isHost) {
          void room.localParticipant.publishData(
            encoder.encode(JSON.stringify({ type: 'state', active: activeRef.current })),
            { reliable: true, topic: TOPIC, destinationIdentities: [msg.from] },
          )
        }
      } catch {
        // ignore
      }
    }
    room.on(RoomEvent.DataReceived, onData)
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

  const toggle = () => {
    if (!isHost) return
    const next = !activeRef.current
    setActive(next)
    void broadcast(next)
    const call = next ? admin.recordStart(room.name) : admin.recordStop(room.name)
    void call.catch(() => {
      // backend rejected — revert and tell everyone
      setActive(!next)
      void broadcast(!next)
    })
  }

  return { active, toggle }
}
