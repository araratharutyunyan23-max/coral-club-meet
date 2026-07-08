import { useEffect, useRef, type CSSProperties } from 'react'
import { LangToggle } from '../components/LangToggle'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../lib/auth'
import { useLang, useT } from '../lib/i18n'

/**
 * Signed-out front door (Direction A · "Beacon"). Shown on the bare home when
 * sign-in is required and there is no session. The Ripple mark sits at centre as
 * the emitter of the Signal field; one action — the official Google button.
 * Guests who open a room link never see this (they route straight to the lobby).
 */
export function WelcomeScreen() {
  const t = useT()
  const { lang } = useLang()
  const { gisReady, renderButton } = useAuth()
  const slot = useRef<HTMLDivElement>(null)

  // Render the official Google button in the slot, in the app's language (Google
  // otherwise localizes it from the user's own Google/browser locale). Re-render
  // when the language changes (effect dep) or the theme flips (observer).
  useEffect(() => {
    const el = slot.current
    if (!el || !gisReady) return
    const render = () => renderButton(el, { locale: lang })
    render()
    const obs = new MutationObserver(render)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [gisReady, renderButton, lang])

  return (
    <div className="welcome-screen">
      {/* Signal field — origin slightly above centre so ripples arc up behind the copy. */}
      <div
        className="sf"
        aria-hidden="true"
        style={{ '--ox': '50%', '--oy': '44%', '--sf-rip': '0.4', '--sf-con': '0.62', '--sf-bloom': '0.82', '--sf-dur': '13s', '--sf-spread': '2.2' } as CSSProperties}
      >
        <div className="sf-depth" />
        <div className="sf-contours" />
        <div className="sf-core" />
        <div className="sf-signal">
          <span className="rp" />
          <span className="rp" />
          <span className="rp" />
          <span className="rp" />
        </div>
      </div>
      <div className="sf-calm" data-calm="center" aria-hidden="true" />

      <div className="wc-corner">
        <LangToggle />
        <ThemeToggle />
      </div>

      <div className="wc-beacon">
        <svg className="wc-mark" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="ccWelcomeMark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#34e6d3" />
              <stop offset="1" stopColor="#0f9c8d" />
            </linearGradient>
          </defs>
          <g stroke="url(#ccWelcomeMark)" fill="none" strokeWidth="3.2" strokeLinecap="round">
            <path d="M60 22a38 38 0 0 1 0 76" />
            <path d="M60 38a22 22 0 0 1 0 44" />
            <path d="M60 6a54 54 0 0 1 0 108" opacity=".5" />
          </g>
          <circle cx="60" cy="60" r="8.4" fill="#ff7e63" />
        </svg>

        <div className="wc-wm">
          Coral Club <span>Meet</span>
        </div>

        <h1 className="wc-hl">{t('Sign in to start a meeting.')}</h1>

        {/* Google renders its official button into this slot once its SDK is ready. */}
        <div className="wc-gbtn" ref={slot} />

        <p className="wc-sub">{t('Guests join by link — no account needed.')}</p>
      </div>
    </div>
  )
}
