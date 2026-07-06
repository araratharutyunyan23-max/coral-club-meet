import { useState } from 'react'
import { RippleMark } from '../components/Logo'
import { MeetingReport } from '../components/MeetingReport'
import { Avatar } from '../components/Avatar'
import { buildReport } from '../lib/attendance'
import { getCommitments } from '../lib/commitments'
import { useT } from '../lib/i18n'
import type { CallSummary } from '../lib/types'

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PostCall({ summary, isHost = false, onRejoin, onExit }: { summary: CallSummary; isHost?: boolean; onRejoin: () => void; onExit: () => void }) {
  // The host gets the attendance report, built once (useState initializer) from
  // the call's collected session/talk data. buildReport verifies it matches this
  // room and consumes it, so it's null if we're not the host, nothing was
  // recorded, or a previous call's data would otherwise leak through.
  const [report] = useState(() => (isHost ? buildReport(summary.room) : null))
  // Commitments left during the call — shown to everyone (accountability is public).
  const [commitments] = useState(() => getCommitments(summary.room))
  const hasPanel = !!report || commitments.length > 0
  const t = useT()

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: hasPanel ? 'flex-start' : 'center',
        padding: hasPanel ? '56px 24px 90px' : 32,
        textAlign: 'center',
        overflow: 'hidden',
        background: 'transparent',
        color: 'var(--text)',
        fontFamily: 'var(--font)',
      }}
    >
      {/* "Signal" ambient — the meeting settling out, so leaving still feels Coral Club. */}
      <div className="lobby-ambient" aria-hidden="true">
        <div className="sig-core" />
        <div className="sig-field">
          <span className="sig-ripple" />
          <span className="sig-ripple" />
          <span className="sig-ripple" />
          <span className="sig-ripple" />
        </div>
      </div>
      <div className="lobby-calm" aria-hidden="true" />

      <div style={{ position: 'relative', zIndex: 2, marginBottom: 22 }}>
        <RippleMark size={52} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, fontSize: 28, fontWeight: 700, letterSpacing: '-.01em' }}>{t('You left the meeting')}</div>
      <div style={{ position: 'relative', zIndex: 2, fontSize: 14, color: 'var(--text-mute)', marginTop: 8 }}>
        {summary.room} · {t('Duration')} {formatDuration(summary.durationSec)}
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 12, marginTop: 28 }}>
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
          {t('Rejoin')}
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
          {t('Back to Coral Club')}
        </button>
      </div>

      {report && (
        <>
          <div className="hostrule">
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              {t('Host only')}
            </span>
          </div>
          <MeetingReport report={report} />
        </>
      )}

      {commitments.length > 0 && (
        <div style={{ position: 'relative', zIndex: 2, width: 'min(560px, 92vw)', marginTop: 28, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--teal-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal-soft)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L20 6" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            </span>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{t('Commitments')}</div>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>{commitments.length}</span>
          </div>
          {commitments.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: c.mine ? 'var(--teal-tint)' : undefined }}>
              <Avatar name={c.name} size={30} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.mine ? t('You') : c.name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 1 }}>{c.text}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-mute)', fontFamily: 'var(--mono)', borderTop: '1px solid var(--border)' }}>{t("We'll ask how it went next time.")}</div>
        </div>
      )}
    </div>
  )
}
