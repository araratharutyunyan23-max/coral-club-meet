import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { LocalVideoTrack } from 'livekit-client'
import type { BgId } from '../lib/backgrounds'
import { useIsMobile } from '../lib/hooks'
import { useT } from '../lib/i18n'
import { BackgroundGrid } from './BackgroundPicker'

/**
 * Google-Meet-style "Backgrounds and effects" modal: a large live self-preview
 * (the real processed camera, mirrored) next to the preset grid. The preview
 * attaches the live camera track as a SECOND element — the self-tile keeps its
 * own attachment and there's no extra segmentation cost (both render the same
 * processedTrack). Switching a preset updates both at once.
 */
export function BackgroundModal({
  track,
  cameraOff = false,
  value,
  onChange,
  onClose,
}: {
  /** The live local camera track (undefined when the camera is off/unpublished). */
  track: LocalVideoTrack | null | undefined
  cameraOff?: boolean
  value: BgId
  onChange: (id: BgId) => void
  onClose: () => void
}) {
  const t = useT()
  const isMobile = useIsMobile()
  const videoRef = useRef<HTMLVideoElement>(null)

  const showVideo = !!track && !cameraOff

  useEffect(() => {
    const el = videoRef.current
    if (!el || !track || cameraOff) return
    track.attach(el)
    return () => {
      // Detach only our element — leaves the self-tile's attachment untouched.
      track.detach(el)
    }
  }, [track, cameraOff])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="bgm-backdrop" onClick={onClose}>
      <div
        className={isMobile ? 'bgm bgm-mobile' : 'bgm'}
        role="dialog"
        aria-modal="true"
        aria-label={t('Background & effects')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bgm-head">
          <span>{t('Background & effects')}</span>
          <button type="button" className="bgm-close" aria-label={t('Close')} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>
        <div className="bgm-body">
          <div className="bgm-preview">
            {showVideo ? (
              <video ref={videoRef} autoPlay playsInline muted className="bgm-video" />
            ) : (
              <div className="bgm-camoff">{t('Your camera is off')}</div>
            )}
          </div>
          <div className="bgm-controls">
            <BackgroundGrid value={value} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
