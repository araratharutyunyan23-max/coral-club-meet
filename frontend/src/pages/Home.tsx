import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

/**
 * Landing screen — the "Arrival" hero. Same Signal ripple language as the lobby,
 * but the brand mark on the right is the source that emits the ripples. One clear
 * action: create a meeting → get a link to share.
 */
export function Home({ onCreate }: { onCreate: () => void }) {
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
            <div className="intro">
              <div className="eyebrow">Self-hosted · Coral Club</div>
              <h1>Meetings, the Coral&nbsp;Club way.</h1>
              <p className="lede">Private, unlimited video for your team — on your own server, in your own brand.</p>
            </div>

            <div className="cta-row">
              <button className="cta" onClick={onCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                Create video meeting
              </button>
            </div>

            <ul className="home-badges">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                No time limit
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.4a3.2 3.2 0 0 1 0 5.9" /><path d="M17 13.6a5.5 5.5 0 0 1 3.5 5.4" /></svg>
                Up to 20 on screen
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z" /><path d="M9.3 12l1.9 1.9 3.5-3.7" /></svg>
                Private &amp; self-hosted
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c3.6 4.1 6 6.9 6 10.1a6 6 0 0 1-12 0C6 9.9 8.4 7.1 12 3z" /></svg>
                Your branding
              </li>
            </ul>

            <div className="home-feats">
              <div className="cap">Built in — beyond Zoom &amp; Meet</div>
              <div className="feat-row">
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 3 6.5 8" /><path d="M15.5 3 17.5 8" /><circle cx="12" cy="15" r="6" /><path d="M9.6 15.2 11.2 16.8 14.4 13.6" /></svg></span>
                  <span className="t">Recognition moments</span>
                </div>
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><circle cx="6" cy="18" r="2.4" /><path d="M8.4 6H14M8.4 18H14M6 8.4v7.2M18 8.4v7.2" /></svg></span>
                  <span className="t">Breakout groups</span>
                </div>
                <div className="feat">
                  <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16" /><rect x="5" y="11" width="3.4" height="7" rx="1" /><rect x="10.3" y="6" width="3.4" height="12" rx="1" /><rect x="15.6" y="13" width="3.4" height="5" rx="1" /></svg></span>
                  <span className="t">Meeting report</span>
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
