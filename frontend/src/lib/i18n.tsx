import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { RU } from './i18n-ru'

// Lightweight i18n. The English source string is the key; a missing Russian
// entry falls back to the English argument, so the UI is never blank. The chosen
// language is remembered (localStorage) and auto-detected from the browser first.

export type Lang = 'en' | 'ru'
const KEY = 'cc-lang'

export { RU }

// Non-reactive translate for use outside React components (lib code, toasts).
let currentLang: Lang = 'en'
export function tr(en: string, vars?: Record<string, string | number>): string {
  let s = currentLang === 'ru' ? (RU[en] ?? en) : en
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]))
  return s
}

function detect(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'ru') return v
  } catch {
    /* ignore */
  }
  try {
    if (navigator.language && navigator.language.toLowerCase().startsWith('ru')) return 'ru'
  } catch {
    /* ignore */
  }
  return 'en'
}

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (en: string, vars?: Record<string, string | number>) => string
}
const LangContext = createContext<Ctx | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = detect()
    currentLang = l
    try {
      document.documentElement.setAttribute('lang', l)
    } catch {
      /* ignore */
    }
    return l
  })
  const setLang = useCallback((l: Lang) => {
    currentLang = l
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* ignore */
    }
    try {
      document.documentElement.setAttribute('lang', l)
    } catch {
      /* ignore */
    }
    setLangState(l)
  }, [])
  const t = useCallback(
    (en: string, vars?: Record<string, string | number>) => {
      let s = lang === 'ru' ? (RU[en] ?? en) : en
      if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]))
      return s
    },
    [lang],
  )
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): Ctx {
  const c = useContext(LangContext)
  if (!c) throw new Error('useLang must be used within LangProvider')
  return c
}

/** Convenience: just the translate function. */
export function useT() {
  return useLang().t
}
