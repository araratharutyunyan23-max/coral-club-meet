import { useRef, useState } from 'react'
import type { AppScreen, CallSummary, JoinInfo, Role } from './lib/types'
import { fetchToken } from './lib/api'
import { generateRoomId, isRoomCreator, markRoomCreated, parseRoomInput, roomFromUrl, setRoomUrl } from './lib/rooms'
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
  const startedAt = useRef(0)

  const openRoom = (id: string) => {
    setRoomUrl(id)
    setRoom(id)
    setScreen('lobby')
  }

  const enterCall = () => {
    startedAt.current = Date.now()
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
    setSummary({ room: join?.room ?? room ?? '', durationSec })
    setScreen('postcall')
  }

  const handleRejoin = async () => {
    if (!join) return goHome()
    const result = await fetchToken({ room: join.room, identity: join.identity, name: join.name, role: join.role })
    handleJoin({ ...join, ...result, waitForHost: false })
  }

  const goHome = () => {
    setRoomUrl(null)
    setRoom(null)
    setJoin(null)
    setSummary(null)
    setScreen('home')
  }

  const createMeeting = () => {
    const id = generateRoomId()
    markRoomCreated(id)
    openRoom(id)
  }
  // "Join with a code": accepts a bare room code or a full meeting link.
  const joinByCode = (raw: string) => {
    const id = parseRoomInput(raw)
    if (id) openRoom(id)
  }
  const role: Role = room && isRoomCreator(room) ? 'host' : 'participant'

  if (screen === 'home' || !room) {
    return <Home onCreate={createMeeting} onJoinCode={joinByCode} />
  }
  if (screen === 'waiting' && join) {
    return <WaitingRoom roomName={join.room} onCancel={goHome} />
  }
  if (screen === 'call' && join) {
    return <CallRoom join={join} onLeave={handleLeave} />
  }
  if (screen === 'postcall' && summary) {
    return <PostCall summary={summary} onRejoin={handleRejoin} onExit={goHome} />
  }
  return <Lobby room={room} role={role} onJoin={handleJoin} />
}
