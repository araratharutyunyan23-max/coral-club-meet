// Meeting links: a room lives at /<id>. Opening that URL drops you straight
// into the meeting's lobby; "Create" mints a fresh id and updates the URL.

/** Reads the room id from the current URL (first path segment), or null at root. */
export function roomFromUrl(): string | null {
  const seg = window.location.pathname.replace(/^\/+/, '').replace(/[/?#].*$/, '')
  return seg ? decodeURIComponent(seg) : null
}

/** A short, readable, unguessable room id like "a3f9-7k2p-x8qd". */
export function generateRoomId(): string {
  const part = () => Math.random().toString(36).slice(2, 6)
  return `${part()}-${part()}-${part()}`
}

/** The full shareable URL for a room. */
export function meetingUrl(room: string): string {
  return `${window.location.origin}/${encodeURIComponent(room)}`
}

/** Reflects the current room in the address bar (or returns to the root). */
export function setRoomUrl(room: string | null): void {
  window.history.pushState({}, '', room ? `/${encodeURIComponent(room)}` : '/')
}

const CREATED_KEY = 'cc-created-rooms'

/** Remembers that the local user created this room (so they're the host). */
export function markRoomCreated(room: string): void {
  try {
    const list = JSON.parse(localStorage.getItem(CREATED_KEY) || '[]') as string[]
    if (!list.includes(room)) localStorage.setItem(CREATED_KEY, JSON.stringify([...list, room]))
  } catch {
    /* ignore storage failures */
  }
}

/** Whether the local user created this room. */
export function isRoomCreator(room: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CREATED_KEY) || '[]') as string[]).includes(room)
  } catch {
    return false
  }
}

/** Accepts a full link OR a bare code and extracts the room id. */
export function parseRoomInput(raw: string): string {
  const trimmed = raw.trim()
  let candidate = trimmed
  try {
    candidate = new URL(trimmed).pathname
  } catch {
    /* not a full URL — treat as a path or bare code */
  }
  return decodeURIComponent(candidate.replace(/^\/+/, '').replace(/[/?#].*$/, ''))
}
