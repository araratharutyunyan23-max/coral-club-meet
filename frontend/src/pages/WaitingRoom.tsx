import { RippleLoader } from '../components/RippleLoader'
import { useT } from '../lib/i18n'

/** Waiting room shown while the host admits you. The admission itself is
 *  simulated in the prototype; a real lobby requires a backend admit flow. */
export function WaitingRoom({ roomName, onCancel }: { roomName: string; onCancel: () => void }) {
  const t = useT()
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'transparent',
        color: 'var(--text)',
        fontFamily: 'var(--font)',
        textAlign: 'center',
        padding: 32,
      }}
    >
      <RippleLoader size={64} />
      <div style={{ fontSize: 20, fontWeight: 600 }}>{t('Waiting for the host to let you in')}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>{roomName} · {t("You'll join automatically once admitted")}</div>
      <button
        onClick={onCancel}
        style={{
          marginTop: 8,
          height: 42,
          padding: '0 20px',
          borderRadius: 10,
          border: '1px solid var(--border-strong)',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('Cancel')}
      </button>
    </div>
  )
}
