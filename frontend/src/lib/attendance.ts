import { useEffect } from 'react'
import { type Participant, type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'

// Client-side attendance + engagement tracking for the host's post-call report.
// While the host is in the call, we record each participant's join/leave sessions
// and accumulate talk-time from active-speaker events. Presence is reliable;
// talk-time is best-effort (only what the host's client observed). The collected
// data lives in a module-level store so it survives CallRoom unmounting and can
// be read on the PostCall screen. See MeetingReport.tsx for presentation.

export interface ReportParticipant {
  id: string
  name: string
  role: 'host' | 'member'
  isLocal: boolean
  joined: number // epoch ms — first session start
  left: number | null // epoch ms of last leave, or null if still in call when the host left
  sessions: number // 1 normally; >1 when they rejoined
  presentMs: number // summed present time — the hero number
  talkMs: number | null // best-effort; null when we never saw speaker data for them
}

export interface MeetingReport {
  room: string
  startedAt: number
  endedAt: number
  durationMs: number
  participants: ReportParticipant[]
}

type RawSession = { in: number; out: number | null }
interface RawP {
  id: string
  name: string
  isLocal: boolean
  sessions: RawSession[]
  talkMs: number
  hadTalk: boolean
  speakingSince: number | null
}
interface Store {
  valid: boolean // a real call was tracked and its report hasn't been consumed yet
  room: string
  startedAt: number
  endedAt: number | null
  people: Map<string, RawP>
}

const store: Store = { valid: false, room: '', startedAt: 0, endedAt: null, people: new Map() }

const now = () => Date.now()

function ensure(p: Participant): RawP {
  let rp = store.people.get(p.identity)
  if (!rp) {
    rp = { id: p.identity, name: p.name || p.identity, isLocal: p.isLocal, sessions: [], talkMs: 0, hadTalk: false, speakingSince: null }
    store.people.set(p.identity, rp)
  } else if (p.name) {
    rp.name = p.name
  }
  return rp
}
function openSession(p: Participant, at: number) {
  const rp = ensure(p)
  const last = rp.sessions[rp.sessions.length - 1]
  if (last && last.out === null) return // already in call
  rp.sessions.push({ in: at, out: null })
}
function closeSession(p: Participant, at: number) {
  const rp = store.people.get(p.identity)
  if (!rp) return
  const last = rp.sessions[rp.sessions.length - 1]
  if (last && last.out === null) last.out = at
  if (rp.speakingSince != null) {
    rp.talkMs += at - rp.speakingSince
    rp.speakingSince = null
  }
}
function onSpeakers(speakers: Participant[]) {
  const t = now()
  const activeIds = new Set(speakers.map((s) => s.identity))
  for (const s of speakers) {
    const rp = ensure(s)
    rp.hadTalk = true
    if (rp.speakingSince == null) rp.speakingSince = t
  }
  for (const rp of store.people.values()) {
    if (rp.speakingSince != null && !activeIds.has(rp.id)) {
      rp.talkMs += t - rp.speakingSince
      rp.speakingSince = null
    }
  }
}

/**
 * Track attendance for the whole call, host-only. Resets the store on mount,
 * seeds it with everyone already present, then follows connect/disconnect and
 * active-speaker events. On unmount (host leaving) it closes talk timers and
 * stamps the end — leaving still-connected sessions open so they read "In call".
 */
export function useAttendance(room: Room, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    store.valid = true
    store.room = room.name
    store.endedAt = null
    store.people = new Map()

    const t0 = now()
    let earliest = t0
    const seed: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()]
    for (const p of seed) {
      const j = p.joinedAt?.getTime()
      const at = typeof j === 'number' && Number.isFinite(j) && j > 0 ? j : t0
      if (at < earliest) earliest = at
      openSession(p, at)
    }
    store.startedAt = earliest

    const onConnected = (p: RemoteParticipant) => openSession(p, now())
    const onDisconnected = (p: RemoteParticipant) => closeSession(p, now())
    const onSpeakersChanged = (speakers: Participant[]) => onSpeakers(speakers)

    room.on(RoomEvent.ParticipantConnected, onConnected)
    room.on(RoomEvent.ParticipantDisconnected, onDisconnected)
    room.on(RoomEvent.ActiveSpeakersChanged, onSpeakersChanged)

    return () => {
      const t = now()
      for (const rp of store.people.values()) {
        if (rp.speakingSince != null) {
          rp.talkMs += t - rp.speakingSince
          rp.speakingSince = null
        }
      }
      store.endedAt = t
      room.off(RoomEvent.ParticipantConnected, onConnected)
      room.off(RoomEvent.ParticipantDisconnected, onDisconnected)
      room.off(RoomEvent.ActiveSpeakersChanged, onSpeakersChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, enabled])
}

/**
 * Snapshot the collected data into a report for the post-call screen (host only).
 * Order-independent: it works whether or not the hook's unmount cleanup has run
 * yet (PostCall's render can call this before that cleanup), by treating the end
 * as endedAt ?? now() and folding in any in-progress talk. The local host's own
 * open session is closed at end (they're the one leaving); everyone else who is
 * still connected reads as "In call".
 */
export function buildReport(expectedRoom?: string): MeetingReport | null {
  // Only build for a freshly-tracked call that matches the screen's room, and
  // consume it so a later failed rejoin can't resurface a stale report.
  if (!store.valid || store.people.size === 0) return null
  if (expectedRoom != null && store.room !== expectedRoom) return null
  store.valid = false
  const end = store.endedAt ?? now()
  const participants: ReportParticipant[] = []
  for (const rp of store.people.values()) {
    let present = 0
    let joined = Infinity
    let left: number | null = null
    let stillIn = false
    for (const s of rp.sessions) {
      joined = Math.min(joined, s.in)
      const outT = s.out ?? end
      present += Math.max(0, outT - s.in)
      if (s.out === null && !rp.isLocal) stillIn = true
      else left = left === null ? outT : Math.max(left, outT)
    }
    const talkMs = rp.hadTalk ? rp.talkMs + (rp.speakingSince != null ? Math.max(0, end - rp.speakingSince) : 0) : null
    participants.push({
      id: rp.id,
      name: rp.name,
      role: rp.isLocal ? 'host' : 'member',
      isLocal: rp.isLocal,
      joined: joined === Infinity ? store.startedAt : joined,
      left: stillIn ? null : left,
      sessions: rp.sessions.length,
      presentMs: present,
      talkMs,
    })
  }
  return {
    room: store.room,
    startedAt: store.startedAt,
    endedAt: end,
    durationMs: Math.max(0, end - store.startedAt),
    participants,
  }
}
