import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ConnectionQuality, ConnectionState, type Room, Track } from 'livekit-client'
import type { CallView, JoinInfo } from '../lib/types'
import { useConnectionQuality, useIsMobile, useParticipants, useRoomConnection } from '../lib/hooks'
import { useChat, useReactions } from '../lib/datachannel'
import { useMoments } from '../lib/moment'
import { MomentOverlay } from '../components/MomentOverlay'
import { useAttendance } from '../lib/attendance'
import { useQA } from '../lib/qa'
import { useMutedByHost } from '../lib/moderation'
import { useRecording } from '../lib/recording'
import { useRaiseHandChime } from '../lib/raisehand'
import { useJoinChime } from '../lib/joinchime'
import { useCallPip } from '../lib/callpip'
import { useSideRoom } from '../lib/sideroom'
import { useCommitments } from '../lib/commitments'
import { generateRoomId } from '../lib/rooms'
import { SideRoomPicker, SideRoomInvite, SideRoomBanner } from '../components/SideRoom'
import { CommitmentComposer, CommitmentPrompt } from '../components/CommitmentComposer'
import { CommitmentsBoard } from '../components/CommitmentsBoard'
import { RippleLoader } from '../components/RippleLoader'
import { MeetTopBar } from '../components/MeetTopBar'
import { MeetControls } from '../components/MeetControls'
import { GridView } from '../components/GridView'
import { FocusView } from '../components/FocusView'
import { SoloStage } from '../components/SoloStage'
import { RemoteAudio } from '../components/RemoteAudio'
import { SidePanel, type PanelName } from '../components/SidePanel'
import { ReactionsOverlay } from '../components/ReactionsOverlay'
import { useT } from '../lib/i18n'

/** Jump the session to another room (side rooms); keeps identity + devices.
 *  Resolves true on success, false if the token request failed (stayed put). */
export type MoveToRoom = (roomId: string, opts?: { asHost?: boolean; parent?: string | null; audioEnabled?: boolean; videoEnabled?: boolean }) => Promise<boolean>

export function CallRoom({ join, onLeave, onMoveToRoom, mainRoom }: { join: JoinInfo; onLeave: () => void; onMoveToRoom: MoveToRoom; mainRoom: string | null }) {
  const { room, state, error } = useRoomConnection(join, onLeave)
  const t = useT()

  if (error) {
    return <CenterMessage title={t("Couldn't join the call")} detail={error} actionLabel={t('Back to lobby')} onAction={onLeave} />
  }
  // Spinner only before the first successful connect; transient Reconnecting
  // phases keep the call mounted (see CallStage banner).
  if (!room) {
    return <CenterMessage title={t('Connecting…')} spinner />
  }

  const reconnecting = state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting

  return <CallStage room={room} roomName={join.room} reconnecting={reconnecting} isHost={join.role === 'host'} onLeave={onLeave} onMoveToRoom={onMoveToRoom} mainRoom={mainRoom} />
}

/** The in-call UI, mounted once we have a connected Room. */
function CallStage({ room, roomName, reconnecting, isHost, onLeave, onMoveToRoom, mainRoom }: { room: Room; roomName: string; reconnecting: boolean; isHost: boolean; onLeave: () => void; onMoveToRoom: MoveToRoom; mainRoom: string | null }) {
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
  const sideroom = useSideRoom(room)
  const [showAside, setShowAside] = useState(false)
  const commitments = useCommitments(room, roomName)
  const [showCommit, setShowCommit] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  // Follow-through: ask about last session's commitment (per-browser, until auth).
  const [showPrompt, setShowPrompt] = useState(true)
  // Carry the live mic/cam state into the destination room (not the stale lobby default).
  const move: MoveToRoom = (roomId, opts) =>
    onMoveToRoom(roomId, { ...opts, audioEnabled: room.localParticipant.isMicrophoneEnabled, videoEnabled: room.localParticipant.isCameraEnabled })
  // The true main room to return to (survives nested side rooms).
  const trueMain = mainRoom ?? roomName
  useAttendance(room, true) // collect the post-call meeting report for every participant
  // Advertise the host role (LiveKit attribute) so every participant's report identifies the host.
  useEffect(() => {
    if (isHost) void room.localParticipant.setAttributes({ role: 'host' }).catch(() => {})
  }, [room, isHost])
  useRaiseHandChime(room)
  useJoinChime(room)

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
        {mainRoom && <SideRoomBanner onBack={() => move(mainRoom, { parent: null })} />}
        {sideroom.incoming && (
          <SideRoomInvite
            from={sideroom.incoming.from}
            onJoin={() => {
              const invite = sideroom.incoming!
              sideroom.dismiss()
              move(invite.room, { parent: invite.main })
            }}
            onDismiss={sideroom.dismiss}
          />
        )}
        {commitments.prior && !commitments.prior.done && showPrompt && !sideroom.incoming && (
          <CommitmentPrompt
            prior={commitments.prior}
            onDone={() => { commitments.markPriorDone(); setShowPrompt(false) }}
            onDismiss={() => setShowPrompt(false)}
          />
        )}
        {mutedByHost && <MutedByHostToast />}
        <MeetControls room={room} activePanel={panel} onTogglePanel={togglePanel} unread={unread} view={view} onViewChange={setView} sharing={sharing} isHost={isHost} recording={recording.active} onToggleRecord={recording.toggle} onReaction={reactions.send} onOpenPip={pip.supported ? pip.open : undefined} onLeave={onLeave} onCelebrate={isHost ? moments.celebrate : undefined} onMoveAside={() => setShowAside(true)} onLeaveCommitment={() => setShowCommit(true)} onOpenCommitmentsBoard={isHost ? () => setShowBoard(true) : undefined} />
        {showBoard && <CommitmentsBoard items={[...commitments.list].reverse()} onClose={() => setShowBoard(false)} />}
        {showCommit && (
          <CommitmentComposer
            onSend={(text) => { void commitments.send(text); setShowCommit(false) }}
            onClose={() => setShowCommit(false)}
          />
        )}
        {showAside && (
          <SideRoomPicker
            room={room}
            onClose={() => setShowAside(false)}
            onTakeAside={async (ids) => {
              const newRoom = generateRoomId()
              await sideroom.invite(newRoom, ids, trueMain)
              // Move in; if the token request fails, throw so the picker stays open
              // (busy resets) and the initiator can retry rather than inviting people
              // into a room nobody entered.
              const ok = await move(newRoom, { asHost: true, parent: trueMain })
              if (!ok) throw new Error('Could not open the side room')
            }}
          />
        )}

        {panel && (
          <SidePanel
            room={room}
            panel={panel}
            isHost={isHost}
            messages={chat.messages}
            qa={qa}
            onSend={chat.send}
            onSendImage={chat.sendImage}
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
  const t = useT()
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
      {t('Reconnecting…')}
    </div>
  )
}

// Calm, non-alarming degradation notice (a quiet teal pill, not an amber warning).
function PoorConnectionBanner() {
  const t = useT()
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
      {t('Video eased to keep audio clear')}
    </div>
  )
}

function MutedByHostToast() {
  const t = useT()
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
      {t("You've been muted by the host.")}
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
