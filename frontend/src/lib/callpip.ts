import { useEffect, useRef } from 'react'
import { type Participant, type Room, RoomEvent, Track } from 'livekit-client'

// Floating call window (Document Picture-in-Picture), opened on demand from the
// "Mini window" menu item. Shows the active speaker plus mic / leave controls,
// stays on top, and closes when the user comes back to the tab. Chromium-only.

interface DocPiP {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>
}
function getDocPiP(): DocPiP | undefined {
  return (window as unknown as { documentPictureInPicture?: DocPiP }).documentPictureInPicture
}

export function useCallPip(room: Room, onLeave: () => void): { supported: boolean; open: () => void } {
  const supported = typeof window !== 'undefined' && !!getDocPiP()
  const pipRef = useRef<Window | null>(null)
  const openRef = useRef<() => void>(() => {})
  // Keep onLeave fresh without re-running the effect (which would close the PiP).
  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave

  useEffect(() => {
    if (!supported) return

    const videoTrack = (): MediaStreamTrack | undefined => {
      const all: Participant[] = [...room.remoteParticipants.values(), room.localParticipant]
      const order = [...new Set([...room.activeSpeakers.filter((s) => s !== room.localParticipant), ...all])]
      for (const p of order) {
        const screen = p.getTrackPublication(Track.Source.ScreenShare)
        if (screen?.track && !screen.isMuted) return screen.track.mediaStreamTrack
        const cam = p.getTrackPublication(Track.Source.Camera)
        if (cam?.track && !cam.isMuted) return cam.track.mediaStreamTrack
      }
      return undefined
    }

    let videoEl: HTMLVideoElement | null = null
    let micBtn: HTMLButtonElement | null = null
    let camBtn: HTMLButtonElement | null = null
    let handBtn: HTMLButtonElement | null = null
    // The track currently bound to <video>; only reassign srcObject when it
    // actually changes, so high-frequency speaker events don't reset playback.
    let curTrack: MediaStreamTrack | undefined
    // Synchronous guard against a double-open race (requestWindow is async).
    let opening = false
    const NEUTRAL = 'rgba(255,255,255,.1)'
    const OFF = 'rgba(239,75,67,.85)'
    const sv = (inner: string, extra = '') =>
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</svg>`
    const ICON = {
      hand: sv('<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10.5V6a1.5 1.5 0 0 1 3 0v6"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.8-2.4L4 14.5"/>'),
      mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>'),
      micOff: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="4" y1="3" x2="20" y2="21"/>'),
      cam: sv('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
      camOff: sv('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/><line x1="3" y1="3" x2="21" y2="21"/>'),
      phone: sv('<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', ' style="transform:rotate(135deg)"'),
      x: sv('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'),
    }
    const refresh = () => {
      if (videoEl) {
        const t = videoTrack()
        if (t !== curTrack) {
          curTrack = t
          videoEl.srcObject = t ? new MediaStream([t]) : null
        }
        videoEl.style.display = t ? 'block' : 'none'
      }
      const lp = room.localParticipant
      if (micBtn) {
        micBtn.innerHTML = lp.isMicrophoneEnabled ? ICON.mic : ICON.micOff
        micBtn.style.background = lp.isMicrophoneEnabled ? NEUTRAL : OFF
      }
      if (camBtn) {
        camBtn.innerHTML = lp.isCameraEnabled ? ICON.cam : ICON.camOff
        camBtn.style.background = lp.isCameraEnabled ? NEUTRAL : OFF
      }
      if (handBtn) handBtn.style.background = lp.attributes?.handRaised ? 'rgba(255,126,99,.85)' : NEUTRAL
    }

    const open = async () => {
      if (pipRef.current || opening) return
      const api = getDocPiP()
      if (!api) return
      opening = true
      try {
        const win = await api.requestWindow({ width: 280, height: 200 })
        pipRef.current = win
        opening = false
        // Fresh window → fresh <video>; force the next refresh to (re)bind.
        curTrack = undefined
        const d = win.document
        d.body.style.cssText = 'margin:0;height:100vh;display:flex;flex-direction:column;background:#0b0d0f;color:#eef1f3;font-family:system-ui,-apple-system,sans-serif;overflow:hidden'
        const stage = d.createElement('div')
        stage.style.cssText = 'flex:1;position:relative;display:flex;align-items:center;justify-content:center;background:#15181d'
        const avatar = d.createElement('div')
        avatar.textContent = (room.localParticipant.name || room.localParticipant.identity || 'You').slice(0, 1).toUpperCase()
        avatar.style.cssText = 'width:64px;height:64px;border-radius:50%;background:rgba(37,208,192,.16);border:1px solid rgba(37,208,192,.3);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:600;color:#7fe6db'
        videoEl = d.createElement('video')
        videoEl.autoplay = true
        videoEl.muted = true
        videoEl.setAttribute('playsinline', '')
        videoEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'
        stage.append(avatar, videoEl)

        const bar = d.createElement('div')
        bar.style.cssText = 'flex:0 0 auto;display:flex;gap:8px;justify-content:center;padding:9px;background:#0b0d0f'
        const roundBtn = (html: string): HTMLButtonElement => {
          const b = d.createElement('button')
          b.innerHTML = html
          b.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;transition:background .15s'
          return b
        }
        handBtn = roundBtn(ICON.hand)
        handBtn.title = 'Raise hand'
        handBtn.onclick = () => {
          const raised = !!room.localParticipant.attributes?.handRaised
          void room.localParticipant.setAttributes({ handRaised: raised ? '' : String(Date.now()) }).then(refresh).catch(() => {})
        }
        micBtn = roundBtn(ICON.mic)
        micBtn.title = 'Toggle mic'
        micBtn.onclick = () => void room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled).then(refresh).catch(() => {})
        camBtn = roundBtn(ICON.cam)
        camBtn.title = 'Toggle camera'
        camBtn.onclick = () => void room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled).then(refresh).catch(() => {})
        const leave = d.createElement('button')
        leave.innerHTML = ICON.phone
        leave.title = 'Leave call'
        leave.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;background:#ef4b43;color:#fff;cursor:pointer;transition:background .15s'
        // Two-step leave: first click asks to confirm (a ✕), second click leaves —
        // so an accidental tap doesn't hang up. Reverts after a few seconds.
        let confirmLeave = false
        let confirmTimer: number | undefined
        leave.onclick = () => {
          if (confirmLeave) {
            if (confirmTimer) window.clearTimeout(confirmTimer)
            onLeaveRef.current()
            win.close()
            return
          }
          confirmLeave = true
          leave.innerHTML = ICON.x
          leave.title = 'Tap again to leave'
          leave.style.background = '#a8332c'
          if (confirmTimer) window.clearTimeout(confirmTimer)
          confirmTimer = window.setTimeout(() => {
            confirmLeave = false
            leave.innerHTML = ICON.phone
            leave.title = 'Leave call'
            leave.style.background = '#ef4b43'
          }, 3000)
        }
        bar.append(handBtn, micBtn, camBtn, leave)
        d.body.append(stage, bar)
        refresh()
        win.addEventListener('pagehide', () => {
          if (confirmTimer) window.clearTimeout(confirmTimer)
          pipRef.current = null
          videoEl = null
          micBtn = null
          camBtn = null
          handBtn = null
          curTrack = undefined
        })
      } catch {
        /* needs a user gesture / denied */
        opening = false
      }
    }
    openRef.current = () => void open()

    const events = [
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantAttributesChanged,
    ] as const
    events.forEach((e) => room.on(e, refresh))

    // Tidy up the floating window when the user returns to the tab.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && pipRef.current) {
        pipRef.current.close()
        pipRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      events.forEach((e) => room.off(e, refresh))
      document.removeEventListener('visibilitychange', onVisibility)
      if (pipRef.current) {
        pipRef.current.close()
        pipRef.current = null
      }
    }
  }, [room, supported])

  return { supported, open: () => openRef.current() }
}
