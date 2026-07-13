import { useAuth } from '../lib/auth'
import { useIsMobile } from '../lib/hooks'
import { useT } from '../lib/i18n'

/** Signed-in status chip for the top-right chrome cluster: shows the signed-in
 *  label + a sign-out button once the shared access code has been accepted.
 *  Renders nothing when the create-code gate is off or nobody is signed in. */
export function AuthChip() {
  const { authRequired, user, signOut } = useAuth()
  const t = useT()
  const isMobile = useIsMobile()

  if (!authRequired || !user) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Label is hidden on phones so the top-right cluster doesn't collide with the logo. */}
      {!isMobile && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-dim)',
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user.name || t('Signed in')}
        </span>
      )}
      <button
        onClick={() => void signOut()}
        className="chip-btn"
        style={{ height: 32, padding: '0 10px', font: '600 12.5px/1 var(--font)' }}
      >
        {t('Sign out')}
      </button>
    </div>
  )
}
