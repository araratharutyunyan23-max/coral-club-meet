import { useEffect, useRef } from 'react'
import { type Room, Track } from 'livekit-client'
import { useParticipants } from '../lib/hooks'
import { initialsFor } from './Avatar'

/**
 * The solo / waiting state: what the host sees while they're the only one in the
 * room. A calm centered avatar ringed by a gentle Ripple (camera off) or the
 * live self-preview (camera on) — nothing else on the stage. (Inviting people
 * lives in the corner-chrome Info panel.) The caller renders this only while
 * alone, so it gives way to the participant grid the moment someone joins.
 */
export function SoloStage({ room }: { room: Room }) {
  useParticipants(room) // re-render on local camera toggles
  const videoRef = useRef<HTMLVideoElement>(null)

  const local = room.localParticipant
  const name = local.name || local.identity || 'You'

  const cameraPub = local.getTrackPublication(Track.Source.Camera)
  const videoTrack = cameraPub?.track
  const showVideo = !!videoTrack && !cameraPub?.isMuted

  useEffect(() => {
    const el = videoRef.current
    if (!el || !videoTrack || !showVideo) return
    videoTrack.attach(el)
    return () => {
      videoTrack.detach(el)
    }
  }, [videoTrack, showVideo])

  return (
    // Fills the inset, rounded call stage (the frame is provided by CallRoom).
    <div style={{ position: 'absolute', inset: 0 }}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 108, height: 108 }}>
            {[0, 2, 4].map((delay) => (
              <span
                key={delay}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 108,
                  height: 108,
                  border: '2.5px solid var(--ripple-ring)',
                  borderRadius: '50%',
                  transform: 'translate(-50%,-50%)',
                  animation: `rippleSlow 6s ease-out ${delay}s infinite`,
                  pointerEvents: 'none',
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%,-50%)',
                width: 108,
                height: 108,
                borderRadius: '50%',
                background: 'var(--teal-tint)',
                border: '1px solid rgba(37,208,192,.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                fontWeight: 600,
                color: 'var(--teal-soft)',
              }}
            >
              {initialsFor(name)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
