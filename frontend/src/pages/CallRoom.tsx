import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ConnectionQuality, ConnectionState, type Room, Track } from 'livekit-client'
import type { CallView, JoinInfo } from '../lib/types'
import { useConnectionQuality, useIsMobile, useParticipants, useRoomConnection } from '../lib/hooks'
import { useChat, useReactions } from '../lib/datachannel'
import { useMoments } from '../lib/moment'
import { MomentOverlay } from '../components/MomentOverlay'
import { useAttendance } from '../lib/attendance'
import { useBreakout, groupRoom } from '../lib/breakout'
import { BreakoutBanner } from '../components/BreakoutBanner'
import { BreakoutPanel } from '../components/BreakoutPanel'
import { useQA } from '../lib/qa'
import { useMutedByHost } from '../lib/moderation'
import { useRecording } from '../lib/recording'
import { useRaiseHandChime } from '../lib/raisehand'
import { useJoinChime } from '../lib/joinchime'
import { useCallPip } from '../lib/callpip'
import { RippleLoader } from '../components/RippleLoader'
import { MeetTopBar } from '../components/MeetTopBar'
import { MeetControls } from '../components/MeetControls'
import { GridView } from '../components/GridView'
import { FocusView } from '../components/FocusView'
import { SoloStage } from '../components/SoloStage'
import { RemoteAudio } from '../components/RemoteAudio'
import { SidePanel, type PanelName } from '../components/SidePanel'
import { ReactionsOverlay } from '../components/ReactionsOverlay'

export function CallRoom({ join, onLeave }: { join: JoinInfo; onLeave: () => void }) {
  const { room, state, error, switchRoom } = useRoomConnection(join, onLeave)

  if (error) {
    return <CenterMessage title="Couldn't join the call" detail={error} actionLabel="Back to lobby" onAction={onLeave} />
  }
  // Spinner only before the first successful connect; transient Reconnecting
  // phases keep the call mounted (see CallStage banner).
  if (!room) {
    return <CenterMessage title="Connecting…" spinner />
  }

  const reconnecting = state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting

  return <CallStage room={room} roomName={join.room} reconnecting={reconnecting} isHost={join.role === 'host'} onLeave={onLeave} switchRoom={switchRoom} />
}

/** The in-call UI, mounted once we have a connected Room. */
function CallStage({ room, roomName, reconnecting, isHost, onLeave, switchRoom }: { room: Room; roomName: string; reconnecting: boolean; isHost: boolean; onLeave: () => void; switchRoom: (roomName: string) => void }) {
  const isMobile = useIsMobile()
  const [view, setView] = useState<CallView>('tiled')
  const [panel, setPanel] = useState<PanelName | null>(null)
  const chat = useChat(room)
  const reactions = useReactions(room)
  const qa = useQA(room)
  const recording = useRecording(room, isHost)
  const quality = useConnectionQuality(room)
  const mutedByHost = useMutedByHost(room)
  const moments = useMoments(room)
  const bo = useBreakout(room, roomName, isHost)
  const [showBreakout, setShowBreakout] = useState(false)
  useAttendance(room, isHost) // host-only: collect the post-call meeting report
  useRaiseHandChime(room)
  useJoinChime(room)

  // Brief "Returning to the main room…" banner when a participant's group closes.
  const [boClosing, setBoClosing] = useState(false)
  const prevGroup = useRef<number | null>(null)
  useEffect(() => {
    if (prevGroup.current != null && bo.myGroup == null && bo.visiting == null) {
      setBoClosing(true)
      const t = window.setTimeout(() => setBoClosing(false), 1600)
      prevGroup.current = bo.myGroup
      return () => window.clearTimeout(t)
    }
    prevGroup.current = bo.myGroup
  }, [bo.myGroup, bo.visiting])

  // Fallback for self-hosted LiveKit (no server-side MoveParticipant): each client
  // reconnects itself to its breakout group room — or back to the main room.
  const boTarget = bo.visiting != null ? groupRoom(roomName, bo.visiting) : bo.myGroup != null ? groupRoom(roomName, bo.myGroup) : roomName
  useEffect(() => {
    switchRoom(boTarget)
  }, [boTarget, switchRoom])
  const pip = useCallPip(room, onLeave)
  const participants = useParticipants(room)
  const alone = participants.length <= 1
  // Someone presenting a screen → auto-spotlight it (Telemost-style: shared
  // screen centred, everyone else in the right-hand filmstrip).
  const sharing = participants.some((p) => {
    const pub = p.getTrackPublication(Track.Source.ScreenShare)
    return !!pub?.track && !pub.isMuted
  })
  const poorConnection = !reconnecting && (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost)

  // Unread chat badge: count incoming messages while the chat panel is closed.
  const [unread, setUnread] = useState(0)
  const seenRef = useRef(0)
  useEffect(() => {
    if (panel === 'chat') {
      seenRef.current = chat.messages.length
      setUnread(0)
      return
    }
    const fresh = chat.messages.slice(seenRef.current).filter((m) => !m.mine).length
    seenRef.current = chat.messages.length
    if (fresh > 0) setUnread((u) => u + fresh)
  }, [chat.messages, panel])

  const togglePanel = (p: PanelName) => setPanel((cur) => (cur === p ? null : p))

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: 'var(--surround)' }}>
      {/* Signal Field — the call stage floats on the brand's calm water (origin
          beneath the stage so ripples arc up; quietest tuning + strong centre calm). */}
      <div
        className="sf"
        aria-hidden="true"
        style={{ '--ox': '50%', '--oy': '116%', '--sf-rip': '0.2', '--sf-con': '0.55', '--sf-bloom': '0.55', '--sf-dur': '22s', '--sf-spread': '2.6' } as CSSProperties}
      >
        <div className="sf-depth" />
        <div className="sf-contours" />
        <div className="sf-core" />
        <div className="sf-signal">
          <span className="rp" />
          <span className="rp" />
          <span className="rp" />
          <span className="rp" />
        </div>
      </div>
      <div className="sf-calm" data-calm="center-strong" aria-hidden="true" />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <MeetTopBar room={room} roomName={roomName} recording={recording.active} />

        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* One inset, rounded stage floating on the flat surround (Meet-restraint).
            Views + banners render inside it; reactions, toasts and the control
            bar sit over the surround so they're never clipped. The stage shrinks
            to the left when a side panel slides in (it never floats over video). */}
        <div
          style={{
            position: 'absolute',
            left: isMobile ? 8 : 20,
            right: isMobile ? 8 : (panel ? 366 : 20),
            top: isMobile ? 6 : 8,
            bottom: isMobile ? 84 : 92,
            borderRadius: isMobile ? 12 : 18,
            overflow: 'hidden',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            transition: 'right 0.18s ease',
          }}
        >
          {alone ? (
            <SoloStage room={room} />
          ) : sharing || view === 'sidebar' ? (
            <FocusView room={room} isHost={isHost} layout="sidebar" />
          ) : (
            <GridView room={room} isHost={isHost} />
          )}
          {reconnecting && <ReconnectingBanner />}
          {poorConnection && <PoorConnectionBanner />}
        </div>

        <ReactionsOverlay active={reactions.active} />
        {moments.active && <MomentOverlay key={moments.active.id} moment={moments.active} onDone={moments.dismiss} />}
        {bo.visiting != null ? (
          <BreakoutBanner host group={bo.visiting} endsAt={bo.state.endsAt} onBack={bo.backToControl} />
        ) : bo.myGroup != null ? (
          <BreakoutBanner group={bo.myGroup} endsAt={bo.state.endsAt} message={bo.state.message} asked={bo.askedHelp} onAskHelp={bo.askHelp} />
        ) : boClosing ? (
          <BreakoutBanner group={0} closing />
        ) : null}
        {mutedByHost && <MutedByHostToast />}
        <MeetControls room={room} activePanel={panel} onTogglePanel={togglePanel} unread={unread} view={view} onViewChange={setView} sharing={sharing} isHost={isHost} recording={recording.active} onToggleRecord={recording.toggle} onReaction={reactions.send} onOpenPip={pip.supported ? pip.open : undefined} onLeave={onLeave} onCelebrate={isHost ? moments.celebrate : undefined} onOpenBreakout={isHost ? () => setShowBreakout(true) : undefined} />
        {showBreakout && <BreakoutPanel room={room} bo={bo} onClose={() => setShowBreakout(false)} />}

        {panel && (
          <SidePanel
            room={room}
            panel={panel}
            isHost={isHost}
            messages={chat.messages}
            qa={qa}
            onSend={chat.send}
            onClose={() => setPanel(null)}
          />
        )}
        </main>

        <RemoteAudio room={room} />
      </div>
    </div>
  )
}

function ReconnectingBanner() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 14px',
        background: 'var(--glass)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        fontSize: 13,
        color: 'var(--text-dim)',
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          borderTopColor: 'var(--teal)',
          animation: 'spin 0.9s linear infinite',
        }}
      />
      Reconnecting…
    </div>
  )
}

// Calm, non-alarming degradation notice (a quiet teal pill, not an amber warning).
function PoorConnectionBanner() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 14px',
        background: 'var(--glass)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-strong)',
        borderRadius: 999,
        fontSize: 13,
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', flex: '0 0 auto' }} />
      Video eased to keep audio clear
    </div>
  )
}

function MutedByHostToast() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 82,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 31,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 15px',
        background: 'rgba(239, 75, 67, 0.16)',
        border: '1px solid rgba(239, 75, 67, 0.35)',
        borderRadius: 10,
        fontSize: 13,
        color: '#ff8a82',
      }}
    >
      You've been muted by the host.
    </div>
  )
}

function CenterMessage({
  title,
  detail,
  spinner,
  actionLabel,
  onAction,
}: {
  title: string
  detail?: string
  spinner?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'transparent',
      }}
    >
      {spinner && <RippleLoader />}
      <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
      {detail && (
        <div style={{ fontSize: 13.5, color: 'var(--text-dim)', maxWidth: 420, textAlign: 'center' }}>{detail}</div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 6,
            height: 42,
            padding: '0 20px',
            borderRadius: 10,
            border: '1px solid var(--border-strong)',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
