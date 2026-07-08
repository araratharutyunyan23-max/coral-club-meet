import type { AuthUser, Role, TokenResult } from './types'

interface TokenParams {
  room: string
  identity: string
  name: string
  role?: Role
}

// Durable host proof: the server returns a signed grant when we create a room; we
// keep it per-room and present it (X-Room-Grant) so host powers survive backend
// restarts. Kept in localStorage since a reload/rejoin must still carry it.
function grantHeader(room?: string): Record<string, string> {
  if (!room) return {}
  try {
    const g = localStorage.getItem('cc-grant:' + room)
    return g ? { 'X-Room-Grant': g } : {}
  } catch {
    return {}
  }
}

/** Requests a LiveKit access token from the backend for the given room/user.
 *  The returned `role` is authoritative (the server decides host vs participant
 *  when sign-in is enabled); callers should prefer it over any local guess. */
export async function fetchToken(params: TokenParams): Promise<TokenResult> {
  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...grantHeader(params.room) },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Token request failed (${res.status})`)
  }

  const data = (await res.json()) as { token: string; url: string; room: string; role?: Role }
  return { ...data, identity: params.identity, name: params.name }
}

/** Public runtime config: whether Google sign-in is required and its client id. */
export interface AppConfig {
  googleClientId: string
  authRequired: boolean
}

export async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('/api/config')
    if (!res.ok) return { googleClientId: '', authRequired: false }
    return (await res.json()) as AppConfig
  } catch {
    // No backend reachable — treat as auth-disabled so the app still loads.
    return { googleClientId: '', authRequired: false }
  }
}

/** Exchanges a Google credential for a session cookie; returns the user. */
export async function loginWithGoogle(credential: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Sign-in failed (${res.status})`)
  }
  return (await res.json()) as AuthUser
}

/** Returns the currently signed-in user, or null if there is no valid session. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return null
    return (await res.json()) as AuthUser
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}

/** How many people are already in a room (for the pre-join lobby). Fail-safe: 0. */
export async function fetchPresence(room: string): Promise<number> {
  try {
    const res = await fetch(`/api/presence?room=${encodeURIComponent(room)}`)
    if (!res.ok) return 0
    const data = (await res.json()) as { count?: number }
    return typeof data.count === 'number' ? data.count : 0
  } catch {
    return 0
  }
}

/** Creates a server-owned meeting (requires a session). Pass a room id to claim
 *  a specific one (host-owned side rooms); omit it for a fresh id. */
export async function createRoom(room?: string): Promise<string> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(room ? { room } : {}),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Could not create meeting (${res.status})`)
  }
  const data = (await res.json()) as { room: string; grant?: string }
  if (data.grant) {
    try {
      localStorage.setItem('cc-grant:' + data.room, data.grant)
    } catch {
      /* storage unavailable — host powers won't survive a backend restart, but the session still does */
    }
  }
  return data.room
}

async function adminPost(action: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/admin/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...grantHeader(body.room as string | undefined) },
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
