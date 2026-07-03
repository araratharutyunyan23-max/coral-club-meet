import { useEffect, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Live annotations over a shared screen. Strokes use normalized (0..1)
// coordinates so they land in the same place on every viewer's screen
// regardless of tile size. Broadcast over the data channel.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC = 'annotate'

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  color: string
  points: Point[]
}

type AnnotateMessage = { type: 's'; stroke: Stroke } | { type: 'c' } | { type: 'u'; id: string }

export function useAnnotations(room: Room) {
  const [strokes, setStrokes] = useState<Stroke[]>([])

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const msg = JSON.parse(decoder.decode(payload)) as AnnotateMessage
        if (msg.type === 's') setStrokes((prev) => [...prev, msg.stroke])
        else if (msg.type === 'u') setStrokes((prev) => prev.filter((s) => s.id !== msg.id))
        else setStrokes([])
      } catch {
        // ignore
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room])

  const addStroke = (stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke])
    void room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 's', stroke })), { reliable: true, topic: TOPIC })
  }

  const clear = () => {
    setStrokes([])
    void room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'c' })), { reliable: true, topic: TOPIC })
  }

  // Undo a specific stroke everywhere (used to take back the drawer's last one).
  const removeStroke = (id: string) => {
    setStrokes((prev) => prev.filter((s) => s.id !== id))
    void room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'u', id })), { reliable: true, topic: TOPIC })
  }

  // Local-only clear (e.g. when the presenter changes) — not broadcast.
  const reset = () => setStrokes([])

  return { strokes, addStroke, clear, removeStroke, reset }
}
