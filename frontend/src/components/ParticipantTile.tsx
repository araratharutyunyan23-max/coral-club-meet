import { useEffect, useRef, useState } from 'react'
import { type Participant, type Room, Track } from 'livekit-client'
import { Avatar } from './Avatar'
import { MicOffIcon } from '../lib/icons'
import { admin } from '../lib/api'
import { notifyModeration } from '../lib/moderation'
import { raiseRank } from '../lib/raisehand'

interface Props {
  participant: Participant
  isLocal?: boolean
  room?: Room
  isHost?: boolean
}

/**
 * Renders a single participant: their camera (or screen share) if available,
 * otherwise an initials avatar, plus name, mute and speaking indicators. Hosts
 * get mute / remove quick actions on hover.
 */
export function ParticipantTile({ participant, isLocal = false, room, isHost = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovered, setHovered] = useState(false)
  const showHostActions = isHost && !isLocal && !!room

  const cameraPub = participant.getTrackPublication(Track.Source.Camera)
  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare)
  const screenActive = !!screenPub?.track && !screenPub.isMuted
  const activePub = screenActive ? screenPub : cameraPub
  const isScreen = activePub === screenPub
  const videoTrack = activePub?.track
  const showVideo = !!videoTrack && !activePub?.isMuted

  useEffect(() => {
    const el = videoRef.current
    if (!el || !videoTrack) return
    videoTrack.attach(el)
    return () => {
      videoTrack.detach(el)
    }
  }, [videoTrack])

  const name = participant.name || participant.identity
  const micMuted = !participant.isMicrophoneEnabled
  const speaking = participant.isSpeaking
  const handRaised = !!participant.attributes?.handRaised
  const handRank = room ? raiseRank(room, participant) : null

  const muteParticipant = () => {
    if (!room) return
    void admin
      .mute(room.name, participant.identity)
      .then(() => notifyModeration(room, 'muted', participant.identity))
      .catch(() => {})
  }
  const removeParticipant = () => {
    if (room) void admin.remove(room.name, participant.identity).catch(() => {})
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
      }}
    >
      {showHostActions && hovered && (
        <div style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 6, zIndex: 6 }}>
          <button
            onClick={muteParticipant}
            title="Mute"
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'rgba(10, 11, 13, 0.7)', backdropFilter: 'blur(6px)', color: '#eef1f3', cursor: 'pointer' }}
          >
            <MicOffIcon size={14} />
          </button>
          <button
            onClick={removeParticipant}
            title="Remove"
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'rgba(10, 11, 13, 0.7)', backdropFilter: 'blur(6px)', color: '#ff8a82', cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {/* The <video> stays mounted so a mute/unmute toggle never tears down the
          attached track element (which would cause a flicker). Visibility is
          controlled with CSS; the avatar overlays it when there is no video. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: isScreen ? 'contain' : 'cover',
          background: '#000',
          transform: isLocal && !isScreen ? 'scaleX(-1)' : undefined,
          display: showVideo ? 'block' : 'none',
        }}
      />
      {!showVideo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-2)',
          }}
        >
          <Avatar name={name} />
        </div>
      )}

      {speaking && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius)',
            border: '2px solid var(--teal)',
            pointerEvents: 'none',
            animation: 'speak 1.9s ease-in-out infinite',
          }}
        />
      )}

      {handRaised && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 9px',
            background: 'var(--coral)',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            color: '#241008',
          }}
          title={handRank ? `Raised hand · #${handRank} in queue` : 'Hand raised'}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>✋</span>
          {handRank != null && <span>{handRank}</span>}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          maxWidth: '90%',
          color: 'var(--text)',
          textShadow: '0 1px 4px var(--surround)',
        }}
      >
        {micMuted && <MicOffIcon size={13} style={{ color: 'var(--danger-soft)' }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isLocal ? `${name} (You)` : name}
        </span>
      </div>
    </div>
  )
}
