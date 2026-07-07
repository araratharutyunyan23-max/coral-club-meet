import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchConfig, fetchMe, loginWithGoogle, logout as apiLogout } from './api'
import type { AuthUser } from './types'

// Google sign-in, mirroring the LangProvider pattern. The provider fetches the
// public runtime config (whether sign-in is required + the OAuth client id),
// restores any existing session cookie, and lazily loads Google Identity
// Services only when it is actually needed.

const GIS_SRC = 'https://accounts.google.com/gsi/client'

// Minimal shape of the bits of the GIS SDK we call.
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void
      renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void
      prompt: () => void
      disableAutoSelect: () => void
    }
  }
}
function gis(): GoogleIdentity | undefined {
  return (window as unknown as { google?: GoogleIdentity }).google
}

interface AuthCtx {
  /** True once config + any existing session have resolved. */
  ready: boolean
  /** Whether the backend requires sign-in to create a meeting. */
  authRequired: boolean
  /** True once the Google SDK has initialized (button can be rendered). */
  gisReady: boolean
  user: AuthUser | null
  /** Renders the official Google button into an element (preferred entry point). */
  renderButton: (el: HTMLElement) => void
  /** One Tap / account-chooser prompt — a fallback for gating the Create button. */
  signIn: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [clientId, setClientId] = useState('')
  const [gisReady, setGisReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const initedRef = useRef(false)

  // Latest user setter for the GIS callback (which is registered once).
  const onCredential = useCallback(async (credential: string) => {
    try {
      const u = await loginWithGoogle(credential)
      setUser(u)
    } catch {
      /* surfaced by the sign-in UI; leave the user signed out */
    }
  }, [])

  // 1) Load runtime config + restore any existing session.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cfg = await fetchConfig()
      if (cancelled) return
      setAuthRequired(cfg.authRequired)
      setClientId(cfg.googleClientId)
      if (cfg.authRequired) {
        const me = await fetchMe()
        if (!cancelled && me) setUser(me)
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 2) Lazily load + initialize Google Identity Services once we know we need it.
  useEffect(() => {
    if (!authRequired || !clientId || initedRef.current) return

    const init = () => {
      const g = gis()
      if (!g?.accounts?.id || initedRef.current) return
      g.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (r) => void onCredential(r.credential),
      })
      initedRef.current = true
      setGisReady(true)
    }

    if (gis()?.accounts?.id) {
      init()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', init, { once: true })
      return
    }
    const sc = document.createElement('script')
    sc.src = GIS_SRC
    sc.async = true
    sc.defer = true
    sc.addEventListener('load', init, { once: true })
    document.head.appendChild(sc)
  }, [authRequired, clientId, onCredential])

  const renderButton = useCallback((el: HTMLElement) => {
    const g = gis()
    if (!g?.accounts?.id) return
    el.innerHTML = ''
    g.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
      logo_alignment: 'left',
    })
  }, [])

  const signIn = useCallback(() => {
    gis()?.accounts?.id?.prompt()
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    gis()?.accounts?.id?.disableAutoSelect()
    setUser(null)
  }, [])

  const value = useMemo<AuthCtx>(
    () => ({ ready, authRequired, gisReady, user, renderButton, signIn, signOut }),
    [ready, authRequired, gisReady, user, renderButton, signIn, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
