import { useEffect, useRef, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Ad-hoc "side room" invites over the data channel. Anyone in a call can pull a
// few people aside into a fresh room: they broadcast an invite naming the new
// room + the target identities; each named client shows a Join / Dismiss prompt.
// Nobody is force-moved — moving happens only when a target accepts.

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TOPIC_SIDEROOM = 'sideroom'
const INVITE_TTL_MS = 40_000

export interface IncomingInvite {
  room: string // the side room to join
  from: string // inviter's display name
}

export function useSideRoom(room: Room) {
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null)
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC_SIDEROOM) return
      try {
        const msg = JSON.parse(decoder.decode(payload)) as { room?: string; targets?: string[] }
        if (!msg.room || !Array.isArray(msg.targets)) return
        if (!msg.targets.includes(room.localParticipant.identity)) return
        setIncoming({ room: msg.room, from: participant?.name || participant?.identity || 'Someone' })
        if (expiry.current) clearTimeout(expiry.current)
        expiry.current = setTimeout(() => setIncoming(null), INVITE_TTL_MS) // stale invites self-clear
      } catch {
        // ignore malformed payloads
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      if (expiry.current) clearTimeout(expiry.current)
    }
  }, [room])

  /** Invite the given participant identities into `newRoom`. */
  const invite = async (newRoom: string, targets: string[]) => {
    if (!targets.length) return
    // Deliver ONLY to the invited identities — the side-room id must not reach
    // the people being left behind. `targets` is kept in the payload as a
    // belt-and-suspenders self-check on the receiver.
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ room: newRoom, targets })), {
      reliable: true,
      topic: TOPIC_SIDEROOM,
      destinationIdentities: targets,
    })
  }

  const dismiss = () => {
    if (expiry.current) clearTimeout(expiry.current)
    setIncoming(null)
  }

  return { incoming, invite, dismiss }
}
