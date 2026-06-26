import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Webinar Q&A over the data channel: questions are broadcast, anyone can upvote
// once, and the panel sorts by votes. (Ephemeral — late joiners see questions
// asked after they join, which is fine for a live session.)

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC = 'qa'

export interface Question {
  id: string
  text: string
  from: string
  votes: number
  mine: boolean
  voted: boolean
}

export interface QAApi {
  questions: Question[]
  ask: (text: string) => void
  upvote: (id: string) => void
}

type QAMessage = { type: 'q'; id: string; text: string } | { type: 'v'; id: string }

export function useQA(room: Room): QAApi {
  const [questions, setQuestions] = useState<Question[]>([])
  const voted = useRef<Set<string>>(new Set())

  useEffect(() => {
    const onData = (payload: Uint8Array, p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const msg = JSON.parse(decoder.decode(payload)) as QAMessage
        if (msg.type === 'q') {
          setQuestions((prev) =>
            prev.some((q) => q.id === msg.id)
              ? prev
              : [...prev, { id: msg.id, text: msg.text, from: p?.name || p?.identity || 'Guest', votes: 0, mine: false, voted: false }],
          )
        } else if (msg.type === 'v') {
          setQuestions((prev) => prev.map((q) => (q.id === msg.id ? { ...q, votes: q.votes + 1 } : q)))
        }
      } catch {
        // ignore malformed
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room])

  const ask = async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    const id = `${room.localParticipant.identity}-${Date.now()}`
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'q', id, text })), { reliable: true, topic: TOPIC })
    setQuestions((prev) => [
      ...prev,
      { id, text, from: room.localParticipant.name || room.localParticipant.identity, votes: 0, mine: true, voted: false },
    ])
  }

  const upvote = async (id: string) => {
    if (voted.current.has(id)) return
    voted.current.add(id)
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'v', id })), { reliable: true, topic: TOPIC })
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, votes: q.votes + 1, voted: true } : q)))
  }

  return { questions, ask, upvote }
}
