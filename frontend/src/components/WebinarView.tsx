import type { Room } from 'livekit-client'
import { canPublish, useParticipants } from '../lib/hooks'
import { useWebinarLive } from '../lib/webinar'
import { admin } from '../lib/api'
import { stageContainer } from '../lib/styles'
import { ParticipantTile } from './ParticipantTile'
import { initialsFor } from './Avatar'

/** Webinar/stage view: presenters (publishers) on stage, view-only audience below
 *  with host "promote to stage". */
export function WebinarView({ room, isHost }: { room: Room; isHost: boolean }) {
  const participants = useParticipants(room)
  const presenters = participants.filter(canPublish)
  const audience = participants.filter((p) => !canPublish(p))
  const { live, setLive } = useWebinarLive(room, isHost)

  return (
    <div style={{ ...stageContainer, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!live && !isHost ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>The session will begin shortly</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>Hang tight — the host is getting set up.</div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>
          {presenters.map((p) => (
            <div key={p.sid || p.identity} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <ParticipantTile participant={p} isLocal={p === room.localParticipant} room={room} isHost={isHost} />
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: '0 0 auto', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Audience</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>{audience.length} view-only</span>
            {!live && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--coral)', border: '1px solid rgba(255, 126, 99, 0.4)', borderRadius: 6, padding: '2px 7px' }}>
                BACKSTAGE
              </span>
            )}
          </div>
          {isHost && (
            <button
              onClick={() => setLive(!live)}
              style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: live ? 'transparent' : 'var(--teal-tint)', color: live ? 'var(--text)' : 'var(--teal-soft)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              {live ? 'Go backstage' : 'Go live'}
            </button>
          )}
        </div>

        {audience.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-mute)' }}>No view-only attendees. Join as “Viewer” from the lobby to populate this.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {audience.map((a) => (
              <div key={a.sid || a.identity} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
                <div style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: '50%', background: 'var(--teal-tint)', border: '1px solid rgba(37,208,192,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--teal-soft)' }}>
                  {initialsFor(a.name || a.identity)}
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || a.identity}</span>
                {isHost && (
                  <button
                    title="Promote to stage"
                    onClick={() => void admin.promote(room.name, a.identity).catch(() => {})}
                    style={{ width: 26, height: 26, flex: '0 0 auto', borderRadius: 7, border: '1px solid rgba(37,208,192,.3)', background: 'rgba(37,208,192,.08)', color: 'var(--teal-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V6M6 12l6-6 6 6" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
