import { useState } from 'react'
import { type Participant, type Room, Track } from 'livekit-client'
import { useActiveSpeaker, useIsMobile, useParticipants } from '../lib/hooks'
import { stageContainer } from '../lib/styles'
import { useT } from '../lib/i18n'
import { ParticipantTile } from './ParticipantTile'

/**
 * Single-feed layouts. The lead tile is whoever is sharing their screen, else a
 * pinned tile, else the active speaker.
 *  - `spotlight`: the lead fills the stage; you ride along in a small PiP.
 *  - `sidebar`: the lead takes the stage; everyone else rides a filmstrip down
 *    the right.
 * Click a filmstrip tile to pin it; click the lead to unpin.
 */
export function FocusView({ room, isHost = false, layout = 'spotlight' }: { room: Room; isHost?: boolean; layout?: 'spotlight' | 'sidebar' }) {
  const t = useT()
  const participants = useParticipants(room)
  const activeSpeaker = useActiveSpeaker(room)
  const isMobile = useIsMobile()
  const [pinnedSid, setPinnedSid] = useState<string | null>(null)

  const isSharing = (p: Participant) => {
    const pub = p.getTrackPublication(Track.Source.ScreenShare)
    return !!pub?.track && !pub.isMuted
  }

  const sharer = participants.find(isSharing)
  const pinned = pinnedSid ? participants.find((p) => p.sid === pinnedSid) : undefined
  const main = sharer ?? pinned ?? activeSpeaker
  const others = participants.filter((p) => p !== main)
  const local = room.localParticipant

  const leadTile = (
    <div
      style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', cursor: pinned ? 'zoom-out' : 'default' }}
      onClick={() => pinned && setPinnedSid(null)}
      title={pinned ? t('Unpin') : undefined}
    >
      <ParticipantTile participant={main} isLocal={main === local} room={room} isHost={isHost} />
    </div>
  )

  // Spotlight: lead fills the stage; the local participant tucks into a PiP.
  if (layout === 'spotlight') {
    const showPip = main !== local
    return (
      <div style={{ ...stageContainer, position: 'absolute' }}>
        {leadTile}
        {showPip && (
          <div style={{ position: 'absolute', right: 26, bottom: 26, width: 212, aspectRatio: '16 / 10', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 34px rgba(0,0,0,.45)', zIndex: 8 }}>
            <ParticipantTile participant={local} isLocal room={room} isHost={isHost} />
          </div>
        )}
      </div>
    )
  }

  // Sidebar: lead on the stage, everyone else in a right-hand filmstrip.
  // On mobile (portrait) stack instead: lead on top, filmstrip a horizontal,
  // horizontally-scrolling strip below.
  return (
    <div style={{ ...stageContainer, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14 }}>
      {leadTile}
      {others.length > 0 && (
        <div
          style={
            isMobile
              ? { flex: '0 0 auto', height: 84, display: 'flex', flexDirection: 'row', gap: 10, overflowX: 'auto', overflowY: 'hidden' }
              : { flex: '0 0 auto', width: 208, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }
          }
        >
          {others.map((p) => (
            <div
              key={p.sid || p.identity}
              onClick={() => setPinnedSid(p.sid || null)}
              title={t('Pin')}
              style={
                isMobile
                  ? { flex: '0 0 auto', cursor: 'pointer', width: 134, aspectRatio: '16 / 10' }
                  : { flex: '0 0 auto', cursor: 'pointer', aspectRatio: '16 / 10' }
              }
            >
              <ParticipantTile participant={p} isLocal={p === local} room={room} isHost={isHost} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
