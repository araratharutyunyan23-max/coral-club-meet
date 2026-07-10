import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'
import { hueFor } from '../components/Avatar'

// Lightweight in-call messaging over LiveKit's data channel. Chat and reactions
// are sent participant-to-participant as JSON payloads on dedicated topics — no
// backend round-trip needed.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const TOPIC_CHAT = 'chat'
const TOPIC_CHAT_IMAGE = 'chat-image'
const TOPIC_REACTION = 'reaction'

// Downscale + re-encode a pasted/attached image before sending, so a big
// screenshot doesn't hog the data channel. WebP keeps text legible at a small
// size; falls back to the original blob if the canvas path is unavailable.
const IMG_MAX_DIM = 1920
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, IMG_MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.9))
    return blob ?? file
  } finally {
    bitmap.close()
  }
}

export interface ChatMessage {
  id: string
  from: string
  text: string
  ts: number
  mine: boolean
  image?: { url: string; name?: string }
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
  const urls = useRef<Set<string>>(new Set())
  const imgSeq = useRef(0)

  // Text messages over the classic data channel.
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

  // Images arrive as (auto-chunked) byte streams; reassemble into a Blob URL.
  useEffect(() => {
    try {
      room.registerByteStreamHandler(TOPIC_CHAT_IMAGE, async (reader, info) => {
        try {
          const chunks = await reader.readAll()
          const blob = new Blob(chunks as BlobPart[], { type: reader.info.mimeType || 'image/webp' })
          const url = URL.createObjectURL(blob)
          urls.current.add(url)
          const p = room.remoteParticipants.get(info.identity)
          const from = p?.name || info.identity || 'Guest'
          setMessages((prev) => [
            ...prev,
            { id: `${info.identity}-img-${Date.now()}-${imgSeq.current++}`, from, text: '', ts: Date.now(), mine: false, image: { url, name: reader.info.name } },
          ])
        } catch {
          // ignore a failed/aborted transfer
        }
      })
    } catch {
      // a handler for this topic is already registered
    }
    return () => {
      try {
        room.unregisterByteStreamHandler(TOPIC_CHAT_IMAGE)
      } catch {
        /* ignore */
      }
    }
  }, [room])

  // Release object URLs when the chat unmounts (i.e. leaving the call).
  useEffect(() => {
    const set = urls.current
    return () => {
      set.forEach((u) => URL.revokeObjectURL(u))
      set.clear()
    }
  }, [])

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

  const sendImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    let blob: Blob
    try {
      blob = await prepareImage(file)
    } catch {
      blob = file
    }
    const ts = Date.now()
    const id = `${room.localParticipant.identity}-img-${ts}-${imgSeq.current++}`
    const name = file.name || 'image'
    // Show it locally right away (optimistic), then push over the byte stream.
    const url = URL.createObjectURL(blob)
    urls.current.add(url)
    setMessages((prev) => [
      ...prev,
      { id, from: room.localParticipant.name || room.localParticipant.identity, text: '', ts, mine: true, image: { url, name } },
    ])
    try {
      const type = blob.type || 'image/webp'
      const outName = name.replace(/\.[^./\\]+$/, '') + (type === 'image/webp' ? '.webp' : '')
      const sendable = new File([blob], outName || 'image.webp', { type })
      await room.localParticipant.sendFile(sendable, { topic: TOPIC_CHAT_IMAGE, mimeType: type })
    } catch {
      // send failed; the local copy is already shown
    }
  }

  return { messages, send, sendImage }
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
    const rise = 230 + Math.random() * 80 // 230..310px
    const sway = (Math.random() - 0.5) * 36 // ±18px
    const dur = 5.2 + Math.random() * 1.1 // 5.2..6.3s — linger longer on screen
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
