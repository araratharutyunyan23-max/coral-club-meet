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
