import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useLang, useT } from '../lib/i18n'

/** Sign-in affordance for the top-right chrome cluster. Renders nothing when the
 *  backend doesn't require sign-in; the official Google button when signed out;
 *  a compact avatar + sign-out when signed in. */
export function GoogleSignIn() {
  const { authRequired, user, gisReady, renderButton, signOut } = useAuth()
  const t = useT()
  const { lang } = useLang()
  const slot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user && gisReady && slot.current) renderButton(slot.current, { locale: lang })
  }, [user, gisReady, renderButton, lang])

  if (!authRequired) return null

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {user.picture && (
          <img
            src={user.picture}
            alt=""
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            style={{ borderRadius: '50%', flex: '0 0 auto' }}
          />
        )}
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
          {user.name || user.email}
        </span>
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

  // Google renders its own button into this slot once the SDK is ready.
  return <div ref={slot} style={{ minWidth: 40, minHeight: 32 }} />
}
