import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

/** Landing screen: create a meeting and get a shareable link. */
export function Home({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', padding: '24px 32px', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={30} />
        <ThemeToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.01em' }}>Coral Club Meet</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', maxWidth: 380, width: '100%' }}>
          <button
            onClick={onCreate}
            style={{ flex: '1 1 300px', minHeight: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, borderRadius: 16, border: '1px solid rgba(37,208,192,.22)', background: 'var(--bg-elev)', color: 'var(--text)', cursor: 'pointer', boxShadow: '0 0 60px rgba(37,208,192,.1)' }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--teal-tint)', border: '1px solid rgba(37,208,192,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal-soft)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Create video meeting</div>
            <div style={{ fontSize: 13, color: 'var(--text-mute)' }}>Get a link to share</div>
          </button>
        </div>
      </div>
    </div>
  )
}
