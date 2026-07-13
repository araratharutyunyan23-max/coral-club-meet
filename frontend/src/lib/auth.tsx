import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchConfig, fetchMe, submitCode as apiSubmitCode, logout as apiLogout } from './api'
import type { AuthUser } from './types'

// Access-code sign-in, mirroring the LangProvider pattern. The provider fetches
// the public runtime config (whether creating a meeting requires the shared
// code) and restores any existing session cookie. No third-party SDK is loaded —
// this is entirely first-party, so it works where Google's hosts are blocked.

interface AuthCtx {
  /** True once config + any existing session have resolved. */
  ready: boolean
  /** Whether the backend requires the access code to create a meeting. */
  authRequired: boolean
  /** Non-null once the code has been accepted (a valid session exists). */
  user: AuthUser | null
  /** Submit the shared access code; resolves true on success, false on a wrong code. */
  submitCode: (code: string) => Promise<boolean>
  /** Clear the session (also called when a create request finds the session expired). */
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  // Load runtime config + restore any existing session.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cfg = await fetchConfig()
      if (cancelled) return
      setAuthRequired(cfg.authRequired)
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

  const submitCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const u = await apiSubmitCode(code)
      setUser(u)
      return true
    } catch {
      return false
    }
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  const value = useMemo<AuthCtx>(
    () => ({ ready, authRequired, user, submitCode, signOut }),
    [ready, authRequired, user, submitCode, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
