import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'
import { hueFor } from '../components/Avatar'

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
  label: string // display name; "You" for the local sender
  hue: number // sender's per-user hue (matches their avatar/tile)
  x: number // spawn origin, % of overlay width (left gutter)
  y: number // spawn origin, px from the bottom (clear of the control bar)
  rise: number // px it travels upward
  sway: number // px of horizontal drift while rising
  dur: number // float duration, seconds
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
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const spawn = (emoji: string, name: string, mine: boolean) => {
    const id = `r-${counter.current++}`
    // Signal-burst spawn: origin in the LEFT gutter only (never the centre /
    // speaker column), clear of the control bar. Per-piece rise/sway/duration
    // jitter so a burst fans out instead of stacking. The sender's hue matches
    // their avatar (same hueFor key), so a reaction is recognisably theirs.
    // Travel is kept modest so the emoji fades (not clips) before the stage top
    // even on short/landscape viewports.
    const x = 7 + Math.random() * 21 // 7%..28% — left gutter
    const y = 112 + Math.random() * 44 // 112..156px above the control bar
    const rise = 210 + Math.random() * 70 // 210..280px
    const sway = (Math.random() - 0.5) * 32 // ±16px
    const dur = 3.6 + Math.random() * 0.8 // 3.6..4.4s
    setActive((prev) => [...prev, { id, emoji, label: mine ? 'You' : name, hue: hueFor(name), x, y, rise, sway, dur }])
    const t = setTimeout(() => {
      timers.current.delete(t)
      setActive((prev) => prev.filter((r) => r.id !== id))
    }, dur * 1000 + 500)
    timers.current.add(t)
  }

  // Clear any in-flight removal timers on unmount (e.g. leaving mid-animation).
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC_REACTION) return
      try {
        const { emoji } = JSON.parse(decoder.decode(payload)) as { emoji: string }
        if (emoji) spawn(emoji, participant?.name || participant?.identity || 'Guest', false)
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
    spawn(emoji, room.localParticipant.name || room.localParticipant.identity, true)
  }

  return { active, send }
}
