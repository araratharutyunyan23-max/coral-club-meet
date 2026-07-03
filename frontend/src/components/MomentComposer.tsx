import { type CSSProperties, type ReactNode, useMemo, useState } from 'react'
import type { Room } from 'livekit-client'
import { useParticipants } from '../lib/hooks'
import { initialsFor, userColor } from './Avatar'
import { type Moment, REASONS, type ReasonDef } from '../lib/moment'

/**
 * Host-only composer for a Moment of Recognition. Pick a person, a Coral Club
 * reason, an optional emoji — Celebrate broadcasts it to everyone (2–3 clicks).
 */
export function MomentComposer({ room, onCelebrate, onClose }: { room: Room; onCelebrate: (m: Omit<Moment, 'id'>) => void; onClose: () => void }) {
  const participants = useParticipants(room)
  const names = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const p of participants) {
      const n = p.name || p.identity
      if (n && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }, [participants])

  const [name, setName] = useState('')
  const [typing, setTyping] = useState(false)
  const [reason, setReason] = useState<ReasonDef | null>(null)
  const [detail, setDetail] = useState('')

  // The celebration emoji is the reason's own (no manual picker).
  const emoji = reason?.emoji ?? ''

  const pickReason = (r: ReasonDef) => {
    setReason(r)
    setDetail(r.detail ? r.detail.def : '')
  }

  const ready = !!name.trim() && !!reason
  const subText = reason ? reason.sub(detail) : ''

  const fire = () => {
    if (!ready || !reason) return
    onCelebrate({
      name: name.trim(),
      label: reason.label,
      sub: reason.sub(detail),
      preset: reason.preset,
      accent: reason.accent,
      emoji: emoji || undefined,
    })
    onClose() // close so the host watches their own celebration on the stage
  }

  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={dialog}>
        <div style={topAccent} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px 12px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,126,99,.15)', border: '1px solid rgba(255,126,99,.4)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <MedalIcon />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, letterSpacing: '-.01em' }}>Recognise someone</h2>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.1em', color: 'var(--text-mute)' }}>HOST ONLY · EVERYONE SEES IT</span>
          </div>
          <button onClick={onClose} title="Close" style={closeBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>

        <div style={{ padding: '4px 18px 16px', display: 'flex', flexDirection: 'column', gap: 15, overflowY: 'auto' }}>
          {/* WHO */}
          <Field label="Who">
            <div style={chipWrap}>
              {names.map((n) => (
                <button key={n} onClick={() => { setName(n); setTyping(false) }} style={chip(name === n && !typing)}>
                  <span style={{ ...miniAv, background: userColor(n) }}>{initialsFor(n)}</span>
                  {n}
                </button>
              ))}
              <button onClick={() => { setTyping((t) => !t); setName('') }} style={{ ...chip(false), color: 'var(--text-mute)' }}>
                <span style={plusAv}>+</span>Type a name
              </button>
            </div>
            {typing && (
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Type a name…" style={input} />
            )}
          </Field>

          {/* REASON */}
          <Field label="For">
            <div style={chipWrap}>
              {REASONS.map((r) => (
                <button key={r.key} onClick={() => pickReason(r)} style={reasonChip(reason?.key === r.key)}>
                  <span style={{ fontSize: 14 }}>{r.emoji}</span>{r.chipLabel}
                </button>
              ))}
            </div>
          </Field>

          {/* CONTEXTUAL DETAIL */}
          {reason?.detail && (
            <Field label={reason.detail.lbl}>
              {reason.detail.type === 'select' ? (
                <div style={chipWrap}>
                  {reason.detail.options!.map((o) => (
                    <button key={o} onClick={() => setDetail(o)} style={optBtn(detail === o)}>{o}</button>
                  ))}
                </div>
              ) : (
                <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={reason.detail.placeholder} style={input} />
              )}
            </Field>
          )}

          {/* LIVE PREVIEW */}
          <div style={preview}>
            <div style={{ position: 'relative', width: 40, height: 40, flex: '0 0 auto' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, background: name.trim() ? userColor(name) : 'var(--fill-hover)' }}>
                {name.trim() ? initialsFor(name) : '?'}
              </div>
              {emoji && <span style={{ position: 'absolute', right: -5, top: -6, fontSize: 15 }}>{emoji}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.trim() || 'Pick someone'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{reason ? `${reason.chipLabel} · ${subText}` : 'Choose a reason to celebrate'}</span>
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 18px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-mute)' }}>One-shot · ~3.5s</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={fire} disabled={!ready} style={celebrateBtn(ready)}>
            <MedalIcon size={17} />
            Celebrate
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-mute)' }}>{label}</span>
      {children}
    </div>
  )
}

function MedalIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 3 6.5 8" /><path d="M15.5 3 17.5 8" /><circle cx="12" cy="15" r="6" /><path d="M9.6 15.2 11.2 16.8 14.4 13.6" />
    </svg>
  )
}

/* ---- styles ---- */
const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,8,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const dialog: CSSProperties = { position: 'relative', width: '100%', maxWidth: 460, maxHeight: '86vh', display: 'flex', flexDirection: 'column', borderRadius: 20, border: '1px solid var(--border-strong)', background: 'var(--bg-elev)', boxShadow: '0 30px 70px rgba(0,0,0,.5)', overflow: 'hidden' }
const topAccent: CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--coral),var(--teal))', opacity: 0.9 }
const closeBtn: CSSProperties = { marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const chipWrap: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 7 }
const miniAv: CSSProperties = { width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }
const plusAv: CSSProperties = { width: 24, height: 24, borderRadius: '50%', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }
const input: CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, background: 'var(--fill-subtle)', border: '1px solid var(--border-strong)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)' }
const preview: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }
const ghostBtn: CSSProperties = { padding: '11px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }

function chip(sel: boolean): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 6px', borderRadius: 999, border: `1px solid ${sel ? 'rgba(37,208,192,.4)' : 'var(--border)'}`, background: sel ? 'var(--teal-tint)' : 'var(--fill-subtle)', color: sel ? 'var(--text)' : 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}
function reasonChip(sel: boolean): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10, border: `1px solid ${sel ? 'rgba(255,126,99,.4)' : 'var(--border)'}`, background: sel ? 'rgba(255,126,99,.15)' : 'var(--fill-subtle)', color: sel ? 'var(--text)' : 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}
function optBtn(sel: boolean): CSSProperties {
  return { padding: '8px 12px', borderRadius: 9, border: `1px solid ${sel ? 'rgba(37,208,192,.4)' : 'var(--border)'}`, background: sel ? 'var(--teal-tint)' : 'var(--fill-subtle)', color: sel ? 'var(--text)' : 'var(--text-dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
}
function celebrateBtn(ready: boolean): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 20px', borderRadius: 11, border: 'none', cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5, background: 'linear-gradient(135deg,var(--coral),#ff9070)', color: '#2a0f08', fontSize: 14, fontWeight: 700 }
}
