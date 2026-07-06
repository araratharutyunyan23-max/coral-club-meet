import { useRef, useState } from 'react'
import type { AppScreen, CallSummary, JoinInfo, Role } from './lib/types'
import { fetchToken } from './lib/api'
import { generateRoomId, isRoomCreator, markRoomCreated, roomFromUrl, setRoomUrl } from './lib/rooms'
import { Home } from './pages/Home'
import { Lobby } from './pages/Lobby'
import { CallRoom } from './pages/CallRoom'
import { PostCall } from './pages/PostCall'
import { WaitingRoom } from './pages/WaitingRoom'

/** Flow: home → (create/join → /j/<id>) → lobby → call → post-call. */
export function App() {
  const [screen, setScreen] = useState<AppScreen>(() => (roomFromUrl() ? 'lobby' : 'home'))
  const [room, setRoom] = useState<string | null>(() => roomFromUrl())
  const [join, setJoin] = useState<JoinInfo | null>(null)
  const [summary, setSummary] = useState<CallSummary | null>(null)
  // While in a side room, the room to offer "back to main"; null in a normal call.
  const [sideParent, setSideParent] = useState<string | null>(null)
  const startedAt = useRef(0)

  const openRoom = (id: string) => {
    setRoomUrl(id)
    setRoom(id)
    setScreen('lobby')
  }

  const enterCall = () => {
    // Preserve the clock across side-room hops — only start it on the first entry.
    if (!startedAt.current) startedAt.current = Date.now()
    setScreen('call')
  }

  const handleJoin = (info: JoinInfo) => {
    setJoin(info)
    if (info.waitForHost) {
      setScreen('waiting')
      window.setTimeout(enterCall, 3500)
    } else {
      enterCall()
    }
  }

  const handleLeave = () => {
    const durationSec = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0
    startedAt.current = 0
    setSummary({ room: join?.room ?? room ?? '', durationSec })
    setScreen('postcall')
  }

  const handleRejoin = async () => {
    if (!join) return goHome()
    const result = await fetchToken({ room: join.room, identity: join.identity, name: join.name, role: join.role })
    handleJoin({ ...join, ...result, waitForHost: false })
  }

  // Jump the current session to a different room (side rooms): reuse the same
  // identity, carry the current mic/cam state, get a fresh token, and re-enter.
  // CallRoom is keyed on the room, so this cleanly tears down the old connection
  // and mounts the new one. Fetch the token FIRST — only mutate room/URL/state on
  // success, so a failed request leaves the current call untouched.
  const moveToRoom = async (roomId: string, opts?: { asHost?: boolean; parent?: string | null; audioEnabled?: boolean; videoEnabled?: boolean }) => {
    if (!join) return
    // Host of a room they created (a new side room, or the main room on return);
    // participant everywhere else.
    const role: Role = opts?.asHost || isRoomCreator(roomId) ? 'host' : 'participant'
    try {
      const result = await fetchToken({ room: roomId, identity: join.identity, name: join.name, role })
      if (opts?.asHost) markRoomCreated(roomId)
      setSideParent(opts?.parent ?? null)
      setRoomUrl(roomId)
      setRoom(roomId)
      handleJoin({
        ...join,
        ...result,
        role,
        audioEnabled: opts?.audioEnabled ?? join.audioEnabled,
        videoEnabled: opts?.videoEnabled ?? join.videoEnabled,
        waitForHost: false,
      })
    } catch {
      // Token request failed — stay in the current room; nothing was changed.
    }
  }

  const goHome = () => {
    setRoomUrl(null)
    setRoom(null)
    setJoin(null)
    setSummary(null)
    setSideParent(null)
    startedAt.current = 0
    setScreen('home')
  }

  const createMeeting = () => {
    const id = generateRoomId()
    markRoomCreated(id)
    openRoom(id)
  }
  const role: Role = room && isRoomCreator(room) ? 'host' : 'participant'

  if (screen === 'home' || !room) {
    return <Home onCreate={createMeeting} />
  }
  if (screen === 'waiting' && join) {
    return <WaitingRoom roomName={join.room} onCancel={goHome} />
  }
  if (screen === 'call' && join) {
    return <CallRoom key={join.room} join={join} onLeave={handleLeave} onMoveToRoom={moveToRoom} mainRoom={sideParent} />
  }
  if (screen === 'postcall' && summary) {
    return <PostCall summary={summary} isHost={(join?.role ?? role) === 'host'} onRejoin={handleRejoin} onExit={goHome} />
  }
  return <Lobby room={room} role={role} onJoin={handleJoin} />
}
