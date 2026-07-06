import { useState } from 'react'
import type { Room } from 'livekit-client'
import { useParticipants } from '../lib/hooks'
import { useT } from '../lib/i18n'
import { Avatar } from './Avatar'

/**
 * Host/participant picker: choose who to pull aside, then invite them into a
 * fresh side room. Nobody is moved without accepting.
 */
export function SideRoomPicker({ room, onClose, onTakeAside }: { room: Room; onClose: () => void; onTakeAside: (identities: string[]) => void | Promise<void> }) {
  const t = useT()
  const participants = useParticipants(room)
  const others = participants.filter((p) => p.identity !== room.localParticipant.identity)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  // Only invite people still in the call — someone selected who then left is dropped.
  const liveSel = [...sel].filter((id) => others.some((p) => p.identity === id))

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const go = async () => {
    if (!liveSel.length || busy) return
    setBusy(true)
    try {
      await onTakeAside(liveSel)
    } catch {
      setBusy(false) // move/invite failed — let them retry, don't strand on "Moving…"
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,.5)', overflow: 'hidden', fontFamily: 'var(--font)' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>{t('Move people aside')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 5, lineHeight: 1.45 }}>{t("Pick who to take into a separate room. They'll get an invite to join — the main call keeps going.")}</div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 10px' }}>
          {others.length === 0 && (
            <div style={{ padding: '18px 12px', fontSize: 13, color: 'var(--text-mute)', textAlign: 'center' }}>{t('No one else is in the call yet.')}</div>
          )}
          {others.map((p) => {
            const name = p.name || p.identity || 'Guest'
            const on = sel.has(p.identity)
            return (
              <button
                key={p.identity}
                onClick={() => toggle(p.identity)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 11, border: 'none', cursor: 'pointer', background: on ? 'var(--teal-tint)' : 'transparent', color: 'var(--text)', textAlign: 'left' }}
              >
                <Avatar name={name} size={34} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span style={{ width: 20, height: 20, flex: '0 0 auto', borderRadius: 6, border: `1.5px solid ${on ? 'var(--teal)' : 'var(--border-strong)'}`, background: on ? 'var(--teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#04211e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('Cancel')}</button>
          <button onClick={go} disabled={!liveSel.length || busy} style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: liveSel.length && !busy ? 'linear-gradient(135deg,var(--teal),var(--teal-bright))' : 'var(--fill-subtle)', color: liveSel.length && !busy ? '#04211e' : 'var(--text-mute)', fontSize: 14, fontWeight: 700, cursor: liveSel.length && !busy ? 'pointer' : 'not-allowed' }}>
            {busy ? t('Moving…') : liveSel.length ? t('Take aside · {n}', { n: liveSel.length }) : t('Take aside')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Incoming invite prompt: someone pulled you aside — Join or Dismiss. */
export function SideRoomInvite({ from, onJoin, onDismiss }: { from: string; onJoin: () => void; onDismiss: () => void }) {
  const t = useT()
  return (
    <div style={{ position: 'fixed', left: '50%', top: 74, transform: 'translateX(-50%)', zIndex: 55, maxWidth: 'min(94vw, 440px)', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px 11px 16px', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,.45)', fontFamily: 'var(--font)' }}>
      <span style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, background: 'var(--teal-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('{from} invites you to a side room', { from })}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}>{t('Step aside to talk — the main call keeps going.')}</div>
      </div>
      <button onClick={onDismiss} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('Dismiss')}</button>
      <button onClick={onJoin} style={{ padding: '8px 15px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--teal),var(--teal-bright))', color: '#04211e', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('Join')}</button>
    </div>
  )
}

/** Slim banner shown while you're in a side room: a way back to the main call. */
export function SideRoomBanner({ onBack }: { onBack: () => void }) {
  const t = useT()
  return (
    <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', zIndex: 24, display: 'flex', alignItems: 'center', gap: 11, padding: '7px 8px 7px 14px', background: 'var(--glass)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-strong)', borderRadius: 999, boxShadow: '0 10px 30px rgba(0,0,0,.32)', fontFamily: 'var(--font)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)', flex: '0 0 auto' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('Side room')}</span>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--fill-subtle)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {t('Back to main')}
      </button>
    </div>
  )
}
