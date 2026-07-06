import { Avatar } from './Avatar'
import { useT } from '../lib/i18n'

interface Commitment {
  id: string
  name: string
  text: string
  mine: boolean
}

const TEAL_LINE = 'color-mix(in srgb, var(--teal) 40%, transparent)'

/**
 * Host's live commitments board: a right-docked glass panel that watches
 * commitments arrive during the call with a running count. Newest rows sit on
 * top. It floats beside the stage without blocking the call — only the panel
 * itself captures pointer events.
 */
export function CommitmentsBoard({ items, onClose }: { items: Commitment[]; onClose: () => void }) {
  const t = useT()

  return (
    <aside
      style={{
        position: 'fixed',
        top: 64,
        right: 20,
        bottom: 92,
        width: 'min(340px, calc(100vw - 32px))',
        zIndex: 34,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,.4)',
        fontFamily: 'var(--font)',
        animation: 'slidein 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div style={{ flex: '0 0 auto', padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 30,
              height: 30,
              flex: '0 0 auto',
              borderRadius: 9,
              background: 'var(--teal-tint)',
              border: `1px solid ${TEAL_LINE}`,
              color: 'var(--teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 21V4" />
              <path d="M5 4h11l-2 4 2 4H5" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)' }}>{t('Commitments')}</span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '5px 10px',
              borderRadius: 999,
              background: 'var(--teal-tint)',
              border: `1px solid ${TEAL_LINE}`,
              color: 'var(--teal-soft)',
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {items.length}
          </span>
          <button
            onClick={onClose}
            title={t('Close')}
            style={{
              width: 28,
              height: 28,
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 7, font: '600 10px/1 var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-mute)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)', animation: 'recblink 2s ease-in-out infinite' }} />
          {t('Live · this call')}
        </div>
      </div>

      {/* List — newest on top (caller prepends) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 ? (
          <div style={{ margin: 'auto', padding: '28px 20px', textAlign: 'center', color: 'var(--text-mute)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-dim)' }}>{t('No commitments yet')}</div>
            <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.45 }}>{t("As people share, they'll appear here live.")}</div>
          </div>
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: 10,
                borderRadius: 11,
                background: c.mine ? 'linear-gradient(100deg, var(--teal-tint), transparent 60%), var(--surface)' : 'var(--surface)',
                border: `1px solid ${c.mine ? TEAL_LINE : 'var(--border)'}`,
                animation: 'slidein 0.24s ease-out',
              }}
            >
              <div style={{ flex: '0 0 auto' }}>
                <Avatar name={c.name} size={32} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {c.mine && (
                    <span style={{ flex: '0 0 auto', font: '700 8px/1 var(--mono)', letterSpacing: '.05em', padding: '2px 4px', borderRadius: 4, background: 'var(--teal-tint)', color: 'var(--teal-soft)' }}>
                      {t('You')}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.4, color: 'var(--text)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{c.text}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          flex: '0 0 auto',
          padding: '11px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)',
          font: '500 11.5px/1.4 var(--mono)',
          color: 'var(--text-mute)',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal-soft)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
          <path d="M12 3v18" />
          <path d="M5 10l7-7 7 7" />
        </svg>
        {t("Everyone's commitments land in the report")}
      </div>
    </aside>
  )
}
