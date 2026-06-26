import { useEffect, useRef } from 'react'
import { type RemoteTrack, Room, RoomEvent, Track } from 'livekit-client'

/**
 * Plays remote participants' audio. Audio tracks are attached to hidden
 * <audio> elements here (not in the tiles) so sound keeps playing across
 * view changes and is independent of which tiles are mounted.
 */
export function RemoteAudio({ room }: { room: Room }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const attach = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return
      const el = track.attach()
      el.autoplay = true
      container.appendChild(el)
    }
    const detach = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return
      track.detach().forEach((el) => el.remove())
    }

    // Catch audio tracks already subscribed before this component mounted.
    room.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        if (pub.track && pub.kind === Track.Kind.Audio) attach(pub.track as RemoteTrack)
      })
    })

    room.on(RoomEvent.TrackSubscribed, attach)
    room.on(RoomEvent.TrackUnsubscribed, detach)
    return () => {
      room.off(RoomEvent.TrackSubscribed, attach)
      room.off(RoomEvent.TrackUnsubscribed, detach)
    }
  }, [room])

  return <div ref={containerRef} style={{ display: 'none' }} aria-hidden />
}
