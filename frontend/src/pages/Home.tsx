import { Fragment, type CSSProperties, useState } from 'react'
import { Logo, RippleMark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { LangToggle } from '../components/LangToggle'
import { GoogleSignIn } from '../components/GoogleSignIn'
import { useIsMobile } from '../lib/hooks'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { isValidRoomSlug, slugifyRoom } from '../lib/rooms'

/**
 * Landing screen — the "Arrival" hero. Same Signal ripple language as the lobby,
 * but the brand mark on the right is the source that emits the ripples. One clear
 * action: create a meeting → get a link to share.
 */
export function Home({ onCreate }: { onCreate: (name?: string) => Promise<'taken' | null> }) {
  const t = useT()
  const { authRequired, user } = useAuth()
  const isMobile = useIsMobile()
  const needsSignIn = authRequired && !user
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const slug = slugifyRoom(name)

  const submit = async () => {
    if (busy) return
    setErr(null)
    let customId: string | undefined
    if (name.trim()) {
      if (!isValidRoomSlug(slug)) {
        setErr(t('Use at least 3 Latin letters or digits — reserved names aren’t allowed.'))
        return
      }
      customId = slug
    }
    setBusy(true)
    try {
      const reason = await onCreate(customId)
      if (reason === 'taken') setErr(t('That name is already taken — choose another.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home-screen">
      {/* "Signal" ambient — ripples emitted from the brand mark on the right. */}
      <div className="home-ambient" aria-hidden="true">
        <div className="amb-base" />
        <div className="core" />
        <div className="ripples">
          <span className="ripple" />
          <span className="ripple" />
          <span className="ripple" />
          <span className="ripple" />
        </div>
      </div>
      <div className="home-calm" aria-hidden="true" />

      {/* chrome */}
      <div style={{ position: 'fixed', zIndex: 4, top: 24, left: 28 }}>
        {/* Mark-only on phones so the header can't collide with the right-hand cluster. */}
        {isMobile ? <RippleMark size={30} /> : <Logo size={30} />}
      </div>
      <div style={{ position: 'fixed', zIndex: 4, top: 24, right: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
        <GoogleSignIn />
        <LangToggle />
        <ThemeToggle />
      </div>

      {/* hero */}
      <div className="home-stage">
        <div className="home-hero">
          <div className="copy">
            <div className="intro">
              {/* Word-by-word reveal on load (same Signal spirit as the welcome wordmark). */}
              <h1>
                {t('Meetings, the Coral Club way.')
                  .split(' ')
                  .map((word, i) => (
                    <Fragment key={i}>
                      {i > 0 && ' '}
                      <span className="hw" style={{ '--i': i } as CSSProperties}>{word}</span>
                    </Fragment>
                  ))}
              </h1>
            </div>

            <div className="cta-row">
              <button className="cta" onClick={submit} disabled={busy}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                {t('Create video meeting')}
              </button>
            </div>

            {/* Optional custom name → a stable, memorable path like /daily. Empty = a
                fresh random id, exactly as before. */}
            <div className="create-name">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setErr(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                placeholder={t('Meeting name (optional)')}
                aria-label={t('Meeting name (optional)')}
                maxLength={80}
              />
              {name.trim() && isValidRoomSlug(slug) && <span className="create-slug" aria-hidden="true">/{slug}</span>}
            </div>
            {err && <div className="create-err" role="alert">{err}</div>}
            {needsSignIn && (
              <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--text-mute)' }}>{t('Sign in with Google to start a meeting. Guests join by link — no account needed.')}</div>
            )}

            <div className="home-feats">
              <div className="cap">{t('Built in — beyond Zoom & Google Meet')}</div>
              <div className="feat-row">
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 3 6.5 8" /><path d="M15.5 3 17.5 8" /><circle cx="12" cy="15" r="6" /><path d="M9.6 15.2 11.2 16.8 14.4 13.6" /></svg></span>
                  <span className="t">{t('Recognition moments')}</span>
                </div>
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L20 6" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></span>
                  <span className="t">{t('Commitments & follow-through')}</span>
                </div>
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3" /><path d="M3.5 20a6 6 0 0 1 11 0" /><path d="M15 8l4 4-4 4" /><path d="M19 12h-6" /></svg></span>
                  <span className="t">{t('Side rooms')}</span>
                </div>
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16" /><rect x="5" y="11" width="3.4" height="7" rx="1" /><rect x="10.3" y="6" width="3.4" height="12" rx="1" /><rect x="15.6" y="13" width="3.4" height="5" rx="1" /></svg></span>
                  <span className="t">{t('Meeting report')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="visual">
            <div className="halo" />
            <svg className="mark" viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="ccHomeMark" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#34e6d3" />
                  <stop offset="1" stopColor="#0f9c8d" />
                </linearGradient>
              </defs>
              <g stroke="url(#ccHomeMark)" fill="none" strokeWidth="3.2" strokeLinecap="round">
                <path d="M60 22a38 38 0 0 1 0 76" />
                <path d="M60 38a22 22 0 0 1 0 44" />
                <path d="M60 6a54 54 0 0 1 0 108" opacity=".5" />
              </g>
              <circle className="corepulse" cx="60" cy="60" r="8.4" fill="#ff7e63" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
