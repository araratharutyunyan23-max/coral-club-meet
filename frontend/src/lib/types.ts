export type Role = 'host' | 'participant' | 'viewer'

/** Result of the backend token request. */
export interface TokenResult {
  token: string
  url: string
  room: string
  identity: string
  name: string
  /** Authoritative role from the server (host only for a room's verified owner). */
  role?: Role
}

/** The signed-in Google user (public profile only). */
export interface AuthUser {
  email: string
  name: string
  picture: string
}

/** Everything needed to join a call, including the user's initial device state. */
export interface JoinInfo extends TokenResult {
  audioEnabled: boolean
  videoEnabled: boolean
  audioDeviceId?: string
  videoDeviceId?: string
  speakerDeviceId?: string
  bg?: import('./backgrounds').BgId
  krisp?: boolean
  role?: Role
  waitForHost?: boolean
  /** The camera/mic stream already acquired in the lobby (within the user's tap).
   *  Reused on join so iOS/WebKit doesn't reject a second getUserMedia that would
   *  run outside the gesture (after the async token fetch + connect). */
  mediaStream?: MediaStream
}

/** Layout modes offered in the control bar's layout switcher. */
export type CallView = 'tiled' | 'sidebar'

export type AppScreen = 'home' | 'lobby' | 'waiting' | 'call' | 'postcall'

/** Summary shown on the post-call screen. */
export interface CallSummary {
  room: string
  durationSec: number
}
