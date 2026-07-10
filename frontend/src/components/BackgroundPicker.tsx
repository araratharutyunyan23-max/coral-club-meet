import { useEffect, useRef, useState } from 'react'
import { BACKGROUNDS, type BgId, type BgPreset, bgSwatchCss } from '../lib/backgrounds'
import { useIsMobile } from '../lib/hooks'
import { useT } from '../lib/i18n'

/**
 * Camera background picker — a "Background" button that opens a popover (a bottom
 * sheet on phones): blur chips on top, then a grid of image backgrounds. Same
 * component is used in the lobby preview and in-call. Styles live in theme.css
 * (.bgp-*). The selection is a controlled value; the parent applies the effect.
 */
export function BackgroundPicker({
  value,
  onChange,
  unavailable = false,
  placement = 'br',
}: {
  value: BgId
  onChange: (id: BgId) => void
  unavailable?: boolean
  /** Desktop anchor corner of the button the popover points at. */
  placement?: 'br' | 'bl'
}) {
  const t = useT()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on Escape and on a click outside the picker.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const chips = BACKGROUNDS.filter((b) => b.kind !== 'image')
  const images = BACKGROUNDS.filter((b) => b.kind === 'image')

  const pick = (p: BgPreset) => {
    if (unavailable && p.id !== 'none') return
    onChange(p.id)
  }

  const Silhouette = () => (
    <svg className="bgp-fig" viewBox="0 0 120 92" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <circle cx="60" cy="32" r="18" /><rect x="24" y="56" width="72" height="58" rx="32" />
    </svg>
  )

  const Chip = (p: BgPreset) => {
    const on = value === p.id
    const dis = unavailable && p.id !== 'none'
    return (
      <button
        key={p.id}
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={p.kind === 'none' ? t('No background') : `${t('Blur')} · ${t(p.sub === 'strong' ? 'strong' : 'light')}`}
        disabled={dis}
        className="bgp-chip"
        onClick={() => pick(p)}
      >
        <span className="bgp-ci">
          {p.kind === 'none' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9.5" cy="10" r="4.2" /><circle cx="15" cy="14.5" r="4.2" opacity=".55" /></svg>
          )}
        </span>
        <span className="bgp-cl">
          <b>{p.kind === 'none' ? t('None') : t('Blur')}</b>
          {p.sub && <i>{t(p.sub === 'strong' ? 'strong' : 'light')}</i>}
        </span>
        <span className="bgp-cx" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
      </button>
    )
  }

  const Thumb = (p: BgPreset) => {
    const on = value === p.id
    const dis = unavailable
    return (
      <button
        key={p.id}
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={`${t('Background')}: ${t(p.label)}`}
        disabled={dis}
        className="bgp-thumb"
        onClick={() => pick(p)}
      >
        <span className="bgp-view" style={{ background: bgSwatchCss(p) }}>
          <Silhouette />
          {p.brand && <span className="bgp-dot" aria-hidden="true" />}
          <span className="bgp-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </span>
        <span className="bgp-cap">{t(p.label)}</span>
      </button>
    )
  }

  const panel = (
    <div
      className={isMobile ? 'bgp-sheet' : `bgp-pop bgp-${placement}`}
      role="dialog"
      aria-label={t('Background & effects')}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile && <div className="bgp-handle" aria-hidden="true" />}
      <div className="bgp-head">
        <span>{t('Background & effects')}</span>
        <button type="button" className="bgp-close" aria-label={t('Close')} onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
      </div>
      {unavailable && (
        <div className="bgp-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13.5" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          <span>{t("Effects aren't available on this device — only “None”.")}</span>
        </div>
      )}
      <div className="bgp-chips" role="radiogroup" aria-label={t('Background')}>{chips.map(Chip)}</div>
      <div className="bgp-sec">{t('Images')}</div>
      <div className="bgp-grid" role="radiogroup" aria-label={t('Image backgrounds')}>{images.map(Thumb)}</div>
      {!isMobile && <span className="bgp-arrow" aria-hidden="true" />}
    </div>
  )

  return (
    <div className="bgp" ref={wrapRef}>
      <button
        type="button"
        className="bgp-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15.5 10.1 11 5.5 9l4.6-1.4L12 3z" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
        {t('Background')}
      </button>
      {open && (isMobile ? <div className="bgp-backdrop" onClick={() => setOpen(false)}>{panel}</div> : panel)}
    </div>
  )
}
