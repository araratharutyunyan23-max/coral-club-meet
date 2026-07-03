import { useCallback, useEffect, useRef, useState } from 'react'
import type { Room } from 'livekit-client'
import { breakout as api, type BreakoutState } from './api'

// Client coordinator for breakout groups. The server owns membership (it moves
// participants between rooms via MoveParticipant); this hook just polls the
// session state and exposes host/participant intents. No client reconnect.

/** LiveKit room name for a breakout group of a meeting (matches the backend). */
export function groupRoom(main: string, idx: number): string {
  return `${main}__g${idx + 1}`
}

export interface UseBreakout {
  state: BreakoutState
  isOpen: boolean
  myGroup: number | null // this participant's group index (0-based), or null
  askedHelp: boolean
  visiting: number | null // host's currently-visited group index, or null
  openGroups: (groups: string[][], durationSec: number, message: string) => Promise<void>
  closeAll: () => Promise<void>
  broadcast: (msg: string) => Promise<void>
  visit: (groupIdx: number) => Promise<void>
  backToControl: () => Promise<void>
  askHelp: () => Promise<void>
}

export function useBreakout(room: Room, mainRoom: string, isHost: boolean): UseBreakout {
  const [state, setState] = useState<BreakoutState>({ open: false })
  const [visiting, setVisiting] = useState<number | null>(null)
  const myId = room.localParticipant.identity

  useEffect(() => {
    let alive = true
    const poll = () =>
      api
        .state(mainRoom)
        .then((s) => {
          if (alive) setState(s)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 3500)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [mainRoom])

  const refresh = useCallback(() => {
    api.state(mainRoom).then(setState).catch(() => {})
  }, [mainRoom])

  const groups = state.groups ?? []
  const myGroupIdx = state.open ? groups.findIndex((g) => g.includes(myId)) : -1
  const myGroup = myGroupIdx >= 0 ? myGroupIdx : null
  const askedHelp = !!state.help?.includes(myId)

  const openGroups = useCallback(async (g: string[][], durationSec: number, message: string) => {
    await api.open(mainRoom, g, durationSec, message)
    refresh()
  }, [mainRoom, refresh])

  const closeAll = useCallback(async () => {
    // If the host is visiting a group, return them to main first — Close only
    // moves group members back, and the host isn't in any group's roster.
    if (visiting != null) {
      await api.visit(mainRoom, groupRoom(mainRoom, visiting), myId, -1).catch(() => {})
    }
    setVisiting(null)
    await api.close(mainRoom)
    refresh()
  }, [mainRoom, myId, visiting, refresh])

  const broadcast = useCallback(async (msg: string) => {
    await api.broadcast(mainRoom, msg)
    refresh()
  }, [mainRoom, refresh])

  const visit = useCallback(async (groupIdx: number) => {
    const from = visiting != null ? groupRoom(mainRoom, visiting) : mainRoom
    await api.visit(mainRoom, from, myId, groupIdx)
    setVisiting(groupIdx)
    refresh()
  }, [mainRoom, myId, visiting, refresh])

  const backToControl = useCallback(async () => {
    const from = visiting != null ? groupRoom(mainRoom, visiting) : mainRoom
    await api.visit(mainRoom, from, myId, -1)
    setVisiting(null)
    refresh()
  }, [mainRoom, myId, visiting, refresh])

  const askHelp = useCallback(async () => {
    // optimistic — reflect the request immediately, then confirm from the server
    setState((s) => ({ ...s, help: s.help?.includes(myId) ? s.help : [...(s.help ?? []), myId] }))
    await api.help(mainRoom, myId).catch(() => {})
    refresh()
  }, [mainRoom, myId, refresh])

  // drop stale visiting state once the breakout is closed
  useEffect(() => {
    if (!state.open && visiting != null) setVisiting(null)
  }, [state.open, visiting])

  // The host owns the timer: auto-close when it expires — even if the panel is
  // dismissed (the panel isn't guaranteed to be mounted).
  const autoClosedRef = useRef(false)
  useEffect(() => {
    if (!isHost) return
    const id = window.setInterval(() => {
      if (state.open && state.endsAt && Date.now() >= state.endsAt) {
        if (!autoClosedRef.current) {
          autoClosedRef.current = true
          void closeAll()
        }
      } else if (!state.open) {
        autoClosedRef.current = false
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [isHost, state.open, state.endsAt, closeAll])

  return { state, isOpen: !!state.open, myGroup, askedHelp, visiting, openGroups, closeAll, broadcast, visit, backToControl, askHelp }
}
