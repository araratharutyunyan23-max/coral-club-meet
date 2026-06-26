import { useEffect, useRef, useState } from 'react'
import { ConnectionQuality, ConnectionState, type Room, Track } from 'livekit-client'
import type { CallView, JoinInfo } from '../lib/types'
import { useConnectionQuality, useParticipants, useRoomConnection } from '../lib/hooks'
import { useChat, useReactions } from '../lib/datachannel'
import { useQA } from '../lib/qa'
import { useMutedByHost } from '../lib/moderation'
import { useRecording } from '../lib/recording'
import { useRaiseHandChime } from '../lib/raisehand'
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
  const { room, state, error } = useRoomConnection(join, onLeave)

  if (error) {
    return <CenterMessage title="Couldn't join the call" detail={error} actionLabel="Back to lobby" onAction={onLeave} />
  }
  // Spinner only before the first successful connect; transient Reconnecting
  // phases keep the call mounted (see CallStage banner).
  if (!room) {
    return <CenterMessage title="Connecting…" spinner />
  }

  const reconnecting = state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting

  return <CallStage room={room} roomName={join.room} reconnecting={reconnecting} isHost={join.role === 'host'} />
}

/** The in-call UI, mounted once we have a connected Room. */
function CallStage({ room, roomName, reconnecting, isHost }: { room: Room; roomName: string; reconnecting: boolean; isHost: boolean }) {
  const [view, setView] = useState<CallView>('tiled')
  const [panel, setPanel] = useState<PanelName | null>(null)
  const chat = useChat(room)
  const reactions = useReactions(room)
  const qa = useQA(room)
  const recording = useRecording(room, isHost)
  const quality = useConnectionQuality(room)
  const mutedByHost = useMutedByHost(room)
  useRaiseHandChime(room)
  const pip = useCallPip(room, () => void room.disconnect())
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surround)' }}>
      <MeetTopBar room={room} roomName={roomName} recording={recording.active} />

      <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* One inset, rounded stage floating on the flat surround (Meet-restraint).
            Views + banners render inside it; reactions, toasts and the control
            bar sit over the surround so they're never clipped. The stage shrinks
            to the left when a side panel slides in (it never floats over video). */}
        <div
          style={{
            position: 'absolute',
            left: 20,
            right: panel ? 366 : 20,
            top: 8,
            bottom: 92,
            borderRadius: 18,
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
        {mutedByHost && <MutedByHostToast />}
        <MeetControls room={room} activePanel={panel} onTogglePanel={togglePanel} unread={unread} view={view} onViewChange={setView} sharing={sharing} isHost={isHost} recording={recording.active} onToggleRecord={recording.toggle} onReaction={reactions.send} onOpenPip={pip.supported ? pip.open : undefined} />

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
