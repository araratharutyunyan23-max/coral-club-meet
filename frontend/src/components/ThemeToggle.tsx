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
      className="chip-btn"
      style={{ width: 32, height: 32 }}
    >
      {theme === 'dark' ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  )
}
