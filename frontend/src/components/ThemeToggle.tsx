import { useState } from 'react'
import { applyTheme, getInitialTheme, type Theme } from '../lib/theme'
import { MoonIcon, SunIcon } from '../lib/icons'

/** Dark ⇄ Tide light theme toggle, persisted to localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-dim)',
      }}
    >
      {theme === 'dark' ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  )
}
