export type Theme = 'dark' | 'light'

const KEY = 'cc-theme'

export function getInitialTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme | null) ?? 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore storage failures */
  }
}
