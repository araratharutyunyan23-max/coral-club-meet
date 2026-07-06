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
        <div style={{ position: 'relative', zIndex: 2, width: 'min(560px, 92vw)', marginTop: 28, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', textAlign: 'left', boxShadow: '0 24px 60px rgba(0,0,0,0.36)' }}>
          {/* coral → teal signal edge */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--coral), var(--teal))' }} />

          <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 36, height: 36, flex: '0 0 auto', borderRadius: 10, background: 'color-mix(in srgb, var(--coral) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--coral) 40%, transparent)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
                </span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>{t('Commitments')}</div>
                  <div style={{ marginTop: 3, fontSize: 12.5, fontFamily: 'var(--mono)', fontWeight: 500, color: 'var(--text-mute)', letterSpacing: '.02em' }}>{summary.room}</div>
                </div>
              </div>
              <span title={t('Everyone in the call sees this')} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--coral) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--coral) 40%, transparent)', color: 'var(--coral)', fontSize: 11, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /></svg>
                {t('Everyone')}
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ font: '600 10px/1 var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-mute)' }}>{t('This call')}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{commitments.length === 1 ? t('1 commitment') : t('{n} commitments', { n: commitments.length })}</span>
            </div>
          </div>

          {commitments.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 22px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: c.mine ? 'linear-gradient(96deg, var(--teal-tint), transparent 62%)' : undefined }}>
              <Avatar name={c.name} size={38} />
              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.mine ? t('You') : c.name}
                  {c.mine && <span style={{ font: '700 9px/1 var(--mono)', letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 5px', borderRadius: 5, background: 'var(--teal-tint)', color: 'var(--teal-soft)' }}>{t('You')}</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--coral)', fontWeight: 700 }}>“</span>{c.text}<span style={{ color: 'var(--coral)', fontWeight: 700 }}>”</span>
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: '50%', background: 'var(--teal-tint)', border: '1px solid color-mix(in srgb, var(--teal) 40%, transparent)', color: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></svg>
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t("We'll ask how it went next time.")}</span>
          </div>
        </div>
      )}
    </div>
  )
}
