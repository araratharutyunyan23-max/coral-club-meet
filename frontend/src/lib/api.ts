import type { TokenResult } from './types'

interface TokenParams {
  room: string
  identity: string
  name: string
  role?: 'host' | 'participant' | 'viewer'
}

/** Requests a LiveKit access token from the backend for the given room/user. */
export async function fetchToken(params: TokenParams): Promise<TokenResult> {
  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Token request failed (${res.status})`)
  }

  const data = (await res.json()) as { token: string; url: string; room: string }
  return { ...data, identity: params.identity, name: params.name }
}

async function adminPost(action: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/admin/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Admin request failed (${res.status})`)
  }
}

/** Host moderation actions (proxied through the backend's RoomService client). */
export const admin = {
  mute: (room: string, identity: string) => adminPost('mute', { room, identity }),
  remove: (room: string, identity: string) => adminPost('remove', { room, identity }),
  promote: (room: string, identity: string) => adminPost('promote', { room, identity }),
  muteAll: (room: string, except: string) => adminPost('mute-all', { room, except }),
  lock: (room: string, locked: boolean) => adminPost('lock', { room, locked }),
  recordStart: (room: string) => adminPost('record/start', { room }),
  recordStop: (room: string) => adminPost('record/stop', { room }),
}

/** Server-authoritative breakout state (returned by GET /api/breakout). */
export interface BreakoutState {
  open: boolean
  groups?: string[][] // group idx -> participant identities
  message?: string
  endsAt?: number // epoch ms, 0/absent = no timer
  help?: string[] // identities who asked for help
}

async function breakoutPost(action: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/breakout/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(b?.error ?? `Breakout request failed (${res.status})`)
  }
}

/** Breakout groups (server-side participant moves; state polled by every client). */
export const breakout = {
  state: async (room: string): Promise<BreakoutState> => {
    const res = await fetch(`/api/breakout?room=${encodeURIComponent(room)}`)
    if (!res.ok) return { open: false }
    return (await res.json()) as BreakoutState
  },
  open: (room: string, groups: string[][], durationSec: number, message: string) => breakoutPost('open', { room, groups, durationSec, message }),
  close: (room: string) => breakoutPost('close', { room }),
  broadcast: (room: string, message: string) => breakoutPost('broadcast', { room, message }),
  help: (room: string, identity: string) => breakoutPost('help', { room, identity }),
  visit: (room: string, from: string, identity: string, group: number) => breakoutPost('visit', { room, from, identity, group }),
}
