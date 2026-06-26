import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Lightweight in-call messaging over LiveKit's data channel. Chat and reactions
// are sent participant-to-participant as JSON payloads on dedicated topics — no
// backend round-trip needed.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const TOPIC_CHAT = 'chat'
const TOPIC_REACTION = 'reaction'

export interface ChatMessage {
  id: string
  from: string
  text: string
  ts: number
  mine: boolean
}

export interface Reaction {
  id: string
  emoji: string
}

/** Chat over the data channel. Messages accumulate for the call's lifetime. */
export function useChat(room: Room) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC_CHAT) return
      try {
        const data = JSON.parse(decoder.decode(payload)) as { id: string; text: string; ts: number }
        setMessages((prev) => [
          ...prev,
          { id: data.id, from: participant?.name || participant?.identity || 'Guest', text: data.text, ts: data.ts, mine: false },
        ])
      } catch {
        // ignore malformed payloads
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    const ts = Date.now()
    const id = `${room.localParticipant.identity}-${ts}`
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ id, text, ts })), {
      reliable: true,
      topic: TOPIC_CHAT,
    })
    setMessages((prev) => [
      ...prev,
      { id, from: room.localParticipant.name || room.localParticipant.identity, text, ts, mine: true },
    ])
  }

  return { messages, send }
}

/** Ephemeral floating reactions over the data channel. */
export function useReactions(room: Room) {
  const [active, setActive] = useState<Reaction[]>([])
  const counter = useRef(0)

  const spawn = (emoji: string) => {
    const id = `r-${counter.current++}`
    setActive((prev) => [...prev, { id, emoji }])
    window.setTimeout(() => setActive((prev) => prev.filter((r) => r.id !== id)), 3400)
  }

  useEffect(() => {
    const onData = (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC_REACTION) return
      try {
        const { emoji } = JSON.parse(decoder.decode(payload)) as { emoji: string }
        if (emoji) spawn(emoji)
      } catch {
        // ignore
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room])

  const send = async (emoji: string) => {
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ emoji })), {
      reliable: false,
      topic: TOPIC_REACTION,
    })
    spawn(emoji)
  }

  return { active, send }
}
