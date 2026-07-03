import { type CSSProperties, useEffect, useState } from 'react'

function useRemaining(endsAt?: number): number | null {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [endsAt])
  if (!endsAt) return null
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000))
}
function mmss(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  group: number // 0-based
  endsAt?: number
  message?: string
  asked?: boolean
  host?: boolean // host visiting a group
  closing?: boolean
  hostName?: string
  onAskHelp?: () => void
  onBack?: () => void
}

/**
 * Slim breakout strip over the group stage: which group you're in, time left,
 * the host's broadcast, and Ask-for-help — or the host's "Visiting" view, or the
 * calm "Returning to the main room…" close. (Server moves people; this only reflects.)
 */
export function BreakoutBanner({ group, endsAt, message, asked = false, host = false, closing = false, hostName, onAskHelp, onBack }: Props) {
  const remaining = useRemaining(endsAt)
  const warn = remaining != null && remaining <= 60
  const rail = closing ? 'var(--teal)' : host ? 'linear-gradient(180deg,var(--teal),var(--coral))' : asked ? 'var(--coral)' : 'var(--teal)'

  return (
    <div style={wrap} aria-live="polite">
      <div style={{ ...railStyle, background: rail }} />

      {closing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--teal) 20%, transparent)', animation: 'bopulse 1.6s ease-in-out infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em' }}>Returning to the main room…</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)' }}>REJOINING EVERYONE</span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}>
            <span style={gid}>{String(group + 1).padStart(2, '0')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: host ? 'var(--coral)' : 'var(--text-mute)' }}>
                {host ? 'Host · visiting' : 'Breakout'}
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.01em' }}>{host ? `Visiting Group ${group + 1}` : `You're in Group ${group + 1}`}</span>
            </div>
          </div>

          {remaining != null && (
            <>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-mute)', opacity: 0.7, flex: '0 0 auto' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto', color: warn ? 'var(--coral)' : undefined }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 14, letterSpacing: '.03em', fontVariantNumeric: 'tabular-nums', color: warn ? 'var(--coral)' : 'var(--text)' }}>{mmss(remaining)}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-mute)' }}>left</span>
              </div>
            </>
          )}

          {!host && message ? (
            <div style={bcast}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--coral)', flex: '0 0 auto', boxShadow: '0 0 8px var(--coral)' }} />
              <span style={{ minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hostName && <b style={{ color: 'var(--coral)', fontWeight: 600 }}>{hostName} </b>}· {message}
              </span>
            </div>
          ) : (
            <span style={{ flex: 1, minWidth: 6 }} />
          )}

          {host ? (
            <button onClick={onBack} style={backBtn}>← Back to control</button>
          ) : asked ? (
            <span style={askedBtn}>✓ Help requested</span>
          ) : (
            <button onClick={onAskHelp} style={askBtn}>Ask for help</button>
          )}
        </>
      )}
    </div>
  )
}

/* ---- styles ---- */
const wrap: CSSProperties = { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 24, minHeight: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px 9px 14px', borderRadius: 14, background: 'var(--glass)', backdropFilter: 'blur(16px) saturate(1.1)', border: '1px solid var(--border-strong)', boxShadow: '0 12px 30px rgba(0,0,0,.34)' }
const railStyle: CSSProperties = { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3 }
const gid: CSSProperties = { width: 30, height: 30, borderRadius: 9, background: 'var(--teal-tint)', border: '1px solid rgba(37,208,192,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--teal-soft)', flex: '0 0 auto' }
const bcast: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, padding: '6px 11px', borderRadius: 9, background: 'var(--coral-tint)', border: '1px solid var(--coral-line)' }
const askBtn: CSSProperties = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--coral-line)', background: 'var(--coral-tint)', color: 'var(--coral)', font: '700 12.5px/1 var(--font)' }
const askedBtn: CSSProperties = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'var(--coral)', color: '#2a0f08', font: '700 12.5px/1 var(--font)' }
const backBtn: CSSProperties = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,var(--teal),var(--teal-bright))', color: '#04211e', font: '700 12.5px/1 var(--font)', boxShadow: '0 8px 20px rgba(37,208,192,.3)' }
