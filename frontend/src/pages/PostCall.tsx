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

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
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
