import { useState, type CSSProperties, type FormEvent } from 'react'
import { LangToggle } from '../components/LangToggle'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'

// "Coral Club Meet" split into words → letters with a running index, so the
// Signal-write reveal can light them up one after another (CSS keys off --i).
const WM_WORDS: { warm: boolean; letters: { ch: string; i: number }[] }[] = (() => {
  const src: [string, boolean][] = [
    ['Coral', false],
    ['Club', false],
    ['Meet', true],
  ]
  let i = 0
  return src.map(([text, warm]) => ({ warm, letters: [...text].map((ch) => ({ ch, i: i++ })) }))
})()

/**
 * Signed-out front door (Direction A · "Beacon"). Shown on the bare home when the
 * create-code gate is on and there is no session. The Ripple mark sits at centre
 * as the emitter of the Signal field; one action — enter the shared access code.
 * Guests who open a room link never see this (they route straight to the lobby).
 */
export function WelcomeScreen() {
  const t = useT()
  const { submitCode } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim()
    if (busy || !c) return
    setBusy(true)
    setWrong(false)
    const ok = await submitCode(c)
    setBusy(false)
    // On success the app re-renders to Home (user is now set); on failure, clear + flag.
    if (!ok) {
      setWrong(true)
      setCode('')
    }
  }

  return (
    <div className="welcome-screen">
      {/* Signal field — origin slightly above centre so ripples arc up behind the copy. */}
      <div
        className="sf"
        aria-hidden="true"
        style={{ '--ox': '50%', '--oy': '44%', '--sf-rip': '0.68', '--sf-con': '0.9', '--sf-bloom': '0.98', '--sf-dur': '13s', '--sf-spread': '2.2' } as CSSProperties}
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
        <div className="wc-mark-wrap">
          <span className="wc-pulse" aria-hidden="true" />
          <span className="wc-pulse wc-p2" aria-hidden="true" />
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
            <circle className="wc-core" cx="60" cy="60" r="8.4" fill="#ff7e63" />
          </svg>
        </div>

        {/* "Coral Club Meet" — the Signal writes the name letter by letter (once on load). */}
        <div className="wc-wm" role="img" aria-label="Coral Club Meet">
          <span className="wc-wm-inner">
            {WM_WORDS.map((w, wi) => (
              <span key={wi} className={w.warm ? 'wc-w warm' : 'wc-w'}>
                {w.letters.map((l) => (
                  <span key={l.i} className="wc-l" style={{ '--i': l.i } as CSSProperties}>
                    {l.ch}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </div>

        <h1 className="wc-hl">{t('Enter the code to create a meeting.')}</h1>

        <form className="wc-code" onSubmit={submit}>
          <input
            className={`wc-code-input${wrong ? ' wrong' : ''}`}
            type="password"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setWrong(false)
            }}
            placeholder={t('Access code')}
            aria-label={t('Access code')}
          />
          <button className="wc-code-btn" type="submit" disabled={busy || !code.trim()}>
            {busy ? t('Checking…') : t('Continue')}
          </button>
        </form>
        {wrong && (
          <p className="wc-code-err" role="alert">
            {t('Wrong code — try again.')}
          </p>
        )}

        <p className="wc-sub">{t('Guests join by link — no account needed.')}</p>
      </div>
    </div>
  )
}
