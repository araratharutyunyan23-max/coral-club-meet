import { useState } from 'react'
import type { SavedCommitment } from '../lib/commitments'
import { useT } from '../lib/i18n'

/** In-call composer: leave a commitment for before the next call. */
export function CommitmentComposer({ onSend, onClose }: { onSend: (text: string) => void; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)
  const ready = !!text.trim() && !busy
  const remaining = 140 - text.length
  const warn = remaining <= 20

  const post = () => {
    if (!ready) return
    setBusy(true)
    onSend(text.trim())
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 440, maxWidth: '92vw', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 20, boxShadow: '0 24px 70px rgba(0,0,0,.5)', overflow: 'hidden', fontFamily: 'var(--font)' }}>
        {/* coral → teal accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--coral), var(--teal))', opacity: 0.9 }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '17px 18px 12px' }}>
          <span style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, background: 'var(--teal-tint)', border: '1px solid color-mix(in srgb, var(--teal) 40%, transparent)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>{t('Leave a commitment')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>{t('What will you do before the next call?')}</div>
          </div>
          <button onClick={onClose} aria-label={t('Cancel')} style={{ marginLeft: 'auto', width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>

        {/* the one ≤140 line */}
        <div style={{ padding: '4px 18px 16px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post()
              }}
              maxLength={140}
              rows={2}
              placeholder={t('e.g. Reach out to 5 new contacts by Friday')}
              style={{ width: '100%', minHeight: 78, resize: 'none', padding: '13px 15px 30px', borderRadius: 12, background: focused ? 'color-mix(in srgb, var(--teal) 5%, var(--fill-subtle))' : 'var(--fill-subtle)', border: `1px solid ${focused ? 'color-mix(in srgb, var(--teal) 40%, transparent)' : 'var(--border-strong)'}`, color: 'var(--text)', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.45, fontWeight: 500, outline: 'none' }}
            />
            <span style={{ position: 'absolute', right: 12, bottom: 10, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.02em', color: warn ? 'var(--coral)' : 'var(--text-mute)' }}>{remaining}</span>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 18px', borderTop: '1px solid var(--border)' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.4, color: 'var(--text-mute)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal-soft)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d="M16 19v-1.4a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 17.6V19" /><circle cx="9.7" cy="8" r="3.4" /><path d="M20 19v-1.4a3.4 3.4 0 0 0-2.6-3.3" /></svg>
            {t('Shared with everyone · in your report')}
          </span>
          <button onClick={onClose} style={{ padding: '11px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t('Cancel')}</button>
          <button onClick={post} disabled={!ready} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto', padding: '12px 20px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,var(--teal),var(--teal-bright))', color: '#04211e', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5, boxShadow: '0 10px 26px rgba(37,208,192,.34), inset 0 1px 0 rgba(255,255,255,.4)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            {t('Post commitment')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Follow-through toast: on rejoining a room, ask about last time's commitment. */
export function CommitmentPrompt({ prior, onDone, onDismiss }: { prior: SavedCommitment; onDone: () => void; onDismiss: () => void }) {
  const t = useT()
  return (
    <div style={{ position: 'fixed', left: '50%', top: 74, transform: 'translateX(-50%)', zIndex: 46, width: 'max-content', maxWidth: 'min(94vw, 430px)', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 54px rgba(0,0,0,.46)', fontFamily: 'var(--font)' }}>
      {/* coral accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--coral), #ff9d84)' }} />

      <div style={{ display: 'flex', gap: 12, padding: '15px 16px 13px' }}>
        <span style={{ width: 38, height: 38, flex: '0 0 auto', borderRadius: 11, background: 'color-mix(in srgb, var(--coral) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--coral) 40%, transparent)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--coral)' }}>{t('Welcome back')}</div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>{t('Last time you committed to')}</div>
          <div style={{ marginTop: 5, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            <span style={{ color: 'var(--coral)', fontWeight: 800 }}>“</span>{prior.text}<span style={{ color: 'var(--coral)', fontWeight: 800 }}>”</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px 15px' }}>
        <span style={{ flex: 1 }} />
        <button onClick={onDismiss} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('Not yet')}</button>
        <button onClick={onDone} style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto', padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--coral),#ff9070)', color: '#2a0f08', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(255,126,99,.32)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {t('Done')}
        </button>
      </div>
    </div>
  )
}
