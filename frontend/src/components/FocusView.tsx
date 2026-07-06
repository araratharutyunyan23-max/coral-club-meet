import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { type Participant, type Room, Track } from 'livekit-client'
import { useActiveSpeaker, useIsMobile, useParticipants } from '../lib/hooks'
import { useAnnotations } from '../lib/annotations'
import { stageContainer } from '../lib/styles'
import { useT } from '../lib/i18n'
import { ParticipantTile } from './ParticipantTile'
import { AnnotationLayer } from './AnnotationLayer'

// Pen colours for screen annotations — brand-first, all readable over video.
const ANNOT_COLORS = ['#ff7e63', '#25d0c0', '#f2c879', '#eef1f3']
const annotBtn: CSSProperties = { padding: '0 11px', height: 32, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'rgba(10, 11, 13, 0.7)', color: '#eef1f3', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }

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

  const annotations = useAnnotations(room)
  const [annotating, setAnnotating] = useState(false)
  const [color, setColor] = useState(ANNOT_COLORS[0])
  const myStrokes = useRef<string[]>([]) // ids of strokes this client drew (for Undo)
  const mainIsShare = !!sharer && main === sharer

  // Drop annotations when the presenter (shared screen) changes.
  useEffect(() => {
    annotations.reset()
    myStrokes.current = []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharer?.sid])

  const onStroke = (s: { id: string; color: string; points: { x: number; y: number }[] }) => {
    myStrokes.current.push(s.id)
    annotations.addStroke(s)
  }
  // My most recent stroke that's still on the canvas (skips ones already cleared).
  const lastMine = (): string | null => {
    for (let i = myStrokes.current.length - 1; i >= 0; i--) {
      const id = myStrokes.current[i]
      if (annotations.strokes.some((s) => s.id === id)) return id
    }
    return null
  }
  const undo = () => {
    const id = lastMine()
    if (!id) return
    annotations.removeStroke(id)
    myStrokes.current = myStrokes.current.filter((x) => x !== id)
  }
  const clearAll = () => {
    annotations.clear()
    myStrokes.current = []
  }

  const leadTile = (
    <div
      style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', cursor: pinned ? 'zoom-out' : 'default' }}
      onClick={() => pinned && setPinnedSid(null)}
      title={pinned ? t('Unpin') : undefined}
    >
      <ParticipantTile participant={main} isLocal={main === local} room={room} isHost={isHost} />
      {mainIsShare && (
        <>
          <AnnotationLayer strokes={annotations.strokes} onStroke={onStroke} active={annotating} color={color} />
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: 14, top: 14, display: 'flex', alignItems: 'center', gap: 6, zIndex: 7 }}>
            <button
              onClick={() => setAnnotating((a) => !a)}
              title={t('Annotate the shared screen')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 11px', height: 32, borderRadius: 8, border: '1px solid var(--border-strong)', background: annotating ? 'var(--coral)' : 'rgba(10, 11, 13, 0.7)', color: annotating ? '#241008' : '#eef1f3', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              {t('Annotate')}
            </button>
            {annotating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 10px', height: 32, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'rgba(10, 11, 13, 0.7)' }}>
                {ANNOT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={t('Pen colour')}
                    aria-label={t('Pen colour {color}', { color: c })}
                    style={{ width: 16, height: 16, padding: 0, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)', boxShadow: color === c ? '0 0 0 1px rgba(0,0,0,0.5)' : 'none' }}
                  />
                ))}
              </div>
            )}
            {annotating && lastMine() && (
              <button onClick={undo} title={t('Undo my last stroke')} style={annotBtn}>{t('Undo')}</button>
            )}
            {annotations.strokes.length > 0 && (
              <button onClick={clearAll} title={t('Clear all annotations')} style={annotBtn}>{t('Clear')}</button>
            )}
          </div>
        </>
      )}
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
