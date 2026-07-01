import { useEffect, useState } from 'react'
import { type Participant, type Room, RoomEvent } from 'livekit-client'
import { canPublish, useParticipants } from '../lib/hooks'
import { admin } from '../lib/api'
import { notifyModeration } from '../lib/moderation'
import { raiseRank } from '../lib/raisehand'
import { initialsFor, userTint } from './Avatar'
import { HandIcon, MicIcon, MicOffIcon } from '../lib/icons'

/** Live roster with host moderation actions (mute, promote, remove, mute-all, lock). */
export function ParticipantsPanel({ room, isHost }: { room: Room; isHost: boolean }) {
  const participants = useParticipants(room)
  const [locked, setLocked] = useState(() => parseLocked(room.metadata))
  const [busy, setBusy] = useState(false)

  // Keep the lock state in sync with the room's server-side metadata.
  useEffect(() => {
    const onMeta = () => setLocked(parseLocked(room.metadata))
    room.on(RoomEvent.RoomMetadataChanged, onMeta)
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, onMeta)
    }
  }, [room])

  const muteAll = async () => {
    setBusy(true)
    try {
      await admin.muteAll(room.name, room.localParticipant.identity)
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const toggleLock = async () => {
    const next = !locked
    setLocked(next)
    try {
      await admin.lock(room.name, next)
    } catch {
      setLocked(!next)
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {isHost && (
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <HostBarButton onClick={muteAll} disabled={busy}>
            Mute all
          </HostBarButton>
          <HostBarButton onClick={toggleLock}>{locked ? 'Unlock room' : 'Lock room'}</HostBarButton>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-mute)', padding: '4px 8px 10px' }}>{participants.length} in the call</div>
        {participants.map((p) => (
          <ParticipantRow key={p.sid || p.identity} room={room} participant={p} isLocal={p === room.localParticipant} isHost={isHost} />
        ))}
      </div>
    </div>
  )
}

function ParticipantRow({ room, participant, isLocal, isHost }: { room: Room; participant: Participant; isLocal: boolean; isHost: boolean }) {
  const name = participant.name || participant.identity
  const micOn = participant.isMicrophoneEnabled
  const handRaised = !!participant.attributes?.handRaised
  const handRank = raiseRank(room, participant)
  const allowPublish = canPublish(participant)

  const mute = async () => {
    try {
      await admin.mute(room.name, participant.identity)
      await notifyModeration(room, 'muted', participant.identity)
    } catch {
      /* ignore */
    }
  }
  const promote = () => void admin.promote(room.name, participant.identity).catch(() => {})
  const remove = () => void admin.remove(room.name, participant.identity).catch(() => {})

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 9 }}>
      <div
        style={{
          ...userTint(name),
          width: 34,
          height: 34,
          flex: '0 0 auto',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {initialsFor(name)}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
        {isLocal && <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}> (You)</span>}
      </div>

      {handRaised && (
        <span title={handRank ? `Raised hand · #${handRank} in queue` : 'Hand raised'} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, color: 'var(--coral)' }}>
          <HandIcon size={15} />
          {handRank != null && <span style={{ fontSize: 12 }}>{handRank}</span>}
        </span>
      )}

      {isHost && !isLocal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!allowPublish && (
            <RowAction title="Promote to stage" onClick={promote} accent>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V6M6 12l6-6 6 6" />
              </svg>
            </RowAction>
          )}
          {micOn && (
            <RowAction title="Mute" onClick={mute}>
              <MicOffIcon size={15} />
            </RowAction>
          )}
          <RowAction title="Remove" onClick={remove} danger>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </RowAction>
        </div>
      ) : (
        <span style={{ color: micOn ? 'var(--text-dim)' : 'var(--danger-soft)', display: 'flex' }}>
          {micOn ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
        </span>
      )}
    </div>
  )
}

function parseLocked(metadata?: string): boolean {
  if (!metadata) return false
  try {
    return (JSON.parse(metadata) as { locked?: boolean })?.locked === true
  } catch {
    return false
  }
}

function HostBarButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: 9,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function RowAction({ title, onClick, danger, accent, children }: { title: string; onClick: () => void; danger?: boolean; accent?: boolean; children: React.ReactNode }) {
  const color = danger ? 'var(--danger-soft)' : accent ? 'var(--teal-soft)' : 'var(--text-dim)'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color, cursor: 'pointer' }}
    >
      {children}
    </button>
  )
}
