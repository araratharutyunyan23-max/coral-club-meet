import { useState } from 'react'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

/**
 * Landing screen — the "Arrival" hero. Same Signal ripple language as the lobby,
 * but the brand mark on the right is the source that emits the ripples. One clear
 * action (create a meeting → get a link); "Join with a code" reveals a small field
 * that accepts a room code or a full link.
 */
export function Home({ onCreate, onJoinCode }: { onCreate: () => void; onJoinCode: (raw: string) => void }) {
  const [showCode, setShowCode] = useState(false)
  const [code, setCode] = useState('')

  const submitCode = () => {
    const v = code.trim()
    if (v) onJoinCode(v)
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
        <Logo size={30} />
      </div>
      <div style={{ position: 'fixed', zIndex: 4, top: 24, right: 28 }}>
        <ThemeToggle />
      </div>

      {/* hero */}
      <div className="home-stage">
        <div className="home-hero">
          <div className="copy">
            <div className="cta-row">
              <button className="cta" onClick={onCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                Create video meeting
              </button>
            </div>
            <div className="subjoin">
              {showCode ? (
                <div className="home-codeinput">
                  <input
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitCode()
                      if (e.key === 'Escape') setShowCode(false)
                    }}
                    placeholder="Meeting code or link"
                  />
                  <button onClick={submitCode}>Join</button>
                </div>
              ) : (
                <>
                  Got an invite?{' '}
                  <a onClick={() => setShowCode(true)}>Join with a code</a>
                </>
              )}
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
