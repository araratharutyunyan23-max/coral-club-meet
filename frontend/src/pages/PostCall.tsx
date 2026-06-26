import type { CallSummary } from '../lib/types'

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PostCall({ summary, onRejoin, onExit }: { summary: CallSummary; onRejoin: () => void; onExit: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
        background: 'transparent',
        color: 'var(--text)',
        fontFamily: 'var(--font)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'linear-gradient(140deg, var(--teal-bright), #13a596)',
          marginBottom: 22,
        }}
      >
        <div style={{ position: 'absolute', width: 11, height: 11, borderRadius: '50%', background: 'var(--bg)', right: 6, bottom: 6 }} />
      </div>

      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.01em' }}>You left the meeting</div>
      <div style={{ fontSize: 14, color: 'var(--text-mute)', marginTop: 8 }}>
        {summary.room} · Duration {formatDuration(summary.durationSec)}
      </div>

      <div
        style={{
          width: 420,
          maxWidth: '90%',
          marginTop: 30,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--teal-tint)',
              border: '1px solid rgba(37,208,192,.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--teal-soft)',
              flex: '0 0 auto',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Recording</div>
            <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>Ready in a few minutes</div>
          </div>
          <button
            onClick={() => window.open('/recordings/', '_blank', 'noopener')}
            title="Open recordings"
            style={{
              padding: '8px 14px',
              borderRadius: 9,
              border: '1px solid rgba(37,208,192,.4)',
              background: 'rgba(37,208,192,.1)',
              color: 'var(--teal-soft)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View recording
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={onRejoin}
          style={{
            padding: '12px 22px',
            borderRadius: 11,
            border: '1px solid var(--border-strong)',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Rejoin
        </button>
        <button
          onClick={onExit}
          style={{
            padding: '12px 22px',
            borderRadius: 11,
            border: 'none',
            background: 'linear-gradient(135deg, var(--teal), var(--teal-bright))',
            color: '#04211e',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 10px 28px rgba(37,208,192,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          Back to Coral Club
        </button>
      </div>
    </div>
  )
}
