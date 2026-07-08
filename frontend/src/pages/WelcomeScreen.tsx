import { useEffect, useRef, type CSSProperties } from 'react'
import { LangToggle } from '../components/LangToggle'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'

/**
 * Signed-out front door (Direction A · "Beacon"). Shown on the bare home when
 * sign-in is required and there is no session. The Ripple mark sits at centre as
 * the emitter of the Signal field; one action — the official Google button.
 * Guests who open a room link never see this (they route straight to the lobby).
 */
export function WelcomeScreen() {
  const t = useT()
  const { gisReady, renderButton } = useAuth()
  const slot = useRef<HTMLDivElement>(null)

  // The visible button (below) is our own, styled exactly to the design. The real
  // Google button is rendered here invisibly (opacity 0) on top of it, so it keeps
  // the native sign-in flow (popup / One Tap) while the user sees our styling.
  useEffect(() => {
    const el = slot.current
    if (!el || !gisReady) return
    renderButton(el, { width: 250 })
  }, [gisReady, renderButton])

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

        <h1 className="wc-hl">{t('Sign in to create a meeting.')}</h1>

        {/* Custom-styled button (visual) with the real Google button layered on top,
            invisible, as the actual click target. */}
        <div className="wc-gbtn-wrap">
          <div className="wc-gbtn-custom" aria-hidden="true">
            <svg className="g" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>{t('Sign in with Google')}</span>
          </div>
          <div className="wc-gbtn-real" ref={slot} />
        </div>

        <p className="wc-sub">{t('Guests join by link — no account needed.')}</p>
      </div>
    </div>
  )
}
