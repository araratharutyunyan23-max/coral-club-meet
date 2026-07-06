import { useState } from 'react'
import type { SavedCommitment } from '../lib/commitments'
import { useT } from '../lib/i18n'

/** In-call composer: leave a commitment for before the next call. */
export function CommitmentComposer({ onSend, onClose }: { onSend: (text: string) => void; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = !!text.trim() && !busy

  const post = () => {
    if (!ready) return
    setBusy(true)
    onSend(text.trim())
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,.5)', overflow: 'hidden', fontFamily: 'var(--font)' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--coral), var(--teal))' }} />
        <div style={{ padding: '18px 20px 6px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, background: 'var(--teal-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>{t('Leave a commitment')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>{t('What will you do before the next call?')}</div>
          </div>
        </div>
        <div style={{ padding: '10px 20px 4px' }}>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post()
            }}
            maxLength={140}
            rows={2}
            placeholder={t('e.g. Reach out to 5 new contacts by Friday')}
            style={{ width: '100%', resize: 'none', padding: '12px 14px', borderRadius: 11, background: 'var(--fill-subtle)', border: '1px solid var(--border-strong)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.4, outline: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--mono)', marginTop: 4 }}>{text.trim().length}/140</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px 18px' }}>
          <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>{t('Shared with everyone · in your report')}</span>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('Cancel')}</button>
          <button onClick={post} disabled={!ready} style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: ready ? 'linear-gradient(135deg,var(--teal),var(--teal-bright))' : 'var(--fill-subtle)', color: ready ? '#04211e' : 'var(--text-mute)', fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed' }}>{t('Post commitment')}</button>
        </div>
      </div>
    </div>
  )
}

/** Follow-through toast: on rejoining a room, ask about last time's commitment. */
export function CommitmentPrompt({ prior, onDone, onDismiss }: { prior: SavedCommitment; onDone: () => void; onDismiss: () => void }) {
  const t = useT()
  return (
    <div style={{ position: 'fixed', left: '50%', top: 74, transform: 'translateX(-50%)', zIndex: 46, maxWidth: 'min(94vw, 460px)', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px 11px 16px', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,.45)', fontFamily: 'var(--font)' }}>
      <span style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, background: 'color-mix(in srgb, var(--coral) 16%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('Last time you committed to')}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{prior.text}”</div>
      </div>
      <button onClick={onDismiss} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('Not yet')}</button>
      <button onClick={onDone} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--teal),var(--teal-bright))', color: '#04211e', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        {t('Done')}
      </button>
    </div>
  )
}
