import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// "Commitments & Follow-through" — the accountability half of recognition.
// Anyone can leave a commitment during a call ("5 calls before Friday"); it's
// broadcast to everyone, collected for the post-call report, and saved to this
// browser so the NEXT time they're in this room we can ask "did you do it?".
// Cross-device reminders need real accounts (auth is deferred); until then the
// follow-through check is per-browser via localStorage.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC = 'commitment'

export interface Commitment {
  id: string
  name: string
  text: string
  ts: number
  mine: boolean
}

// Module-level store — survives CallRoom unmounting so PostCall can read it.
interface Store {
  valid: boolean
  room: string
  list: Commitment[]
}
const store: Store = { valid: false, room: '', list: [] }

// ---- this browser's own commitment per room (for the follow-through check) ----
export interface SavedCommitment {
  text: string
  ts: number
  done: boolean
}
const key = (room: string) => `cc-commit:${room}`

export function getMyCommitment(room: string): SavedCommitment | null {
  try {
    const raw = localStorage.getItem(key(room))
    return raw ? (JSON.parse(raw) as SavedCommitment) : null
  } catch {
    return null
  }
}
function saveMyCommitment(room: string, text: string) {
  try {
    localStorage.setItem(key(room), JSON.stringify({ text, ts: Date.now(), done: false } satisfies SavedCommitment))
  } catch {
    /* storage unavailable — the follow-through check just won't fire */
  }
}
export function markCommitmentDone(room: string) {
  try {
    const s = getMyCommitment(room)
    if (s) localStorage.setItem(key(room), JSON.stringify({ ...s, done: true }))
  } catch {
    /* ignore */
  }
}

export function useCommitments(room: Room, roomName: string) {
  const [list, setList] = useState<Commitment[]>([])
  const counter = useRef(0)
  // Capture the PRIOR commitment (from a previous session) once, before this
  // session's own send overwrites it — that's what the follow-through toast asks about.
  const prior = useRef<SavedCommitment | null>(getMyCommitment(roomName))

  const add = (c: Commitment) => {
    setList((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]))
    if (!store.valid || store.room !== roomName) {
      store.valid = true
      store.room = roomName
      store.list = []
    }
    if (!store.list.some((x) => x.id === c.id)) store.list.push(c)
  }

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const { id, text } = JSON.parse(decoder.decode(payload)) as { id: string; text: string }
        if (!id || !text) return
        add({ id, name: participant?.name || participant?.identity || 'Guest', text, ts: Date.now(), mine: false })
      } catch {
        // ignore malformed payloads
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomName])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    const id = `c-${room.localParticipant.identity}-${counter.current++}-${Date.now()}`
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ id, text })), { reliable: true, topic: TOPIC })
    add({ id, name: room.localParticipant.name || room.localParticipant.identity, text, ts: Date.now(), mine: true })
    saveMyCommitment(roomName, text)
  }

  return { list, send, prior: prior.current }
}

/** Read the call's commitments for the PostCall screen, then consume so a later
 *  call in the same tab doesn't inherit them. */
export function getCommitments(room: string): Commitment[] {
  if (!store.valid || store.room !== room) return []
  const list = [...store.list]
  store.valid = false
  return list
}
