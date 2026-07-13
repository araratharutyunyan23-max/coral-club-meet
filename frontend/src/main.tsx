import { createRoot } from 'react-dom/client'
// Self-hosted brand fonts (were Google Fonts — a render-blocking external
// dependency that stalls the whole page when fonts.googleapis.com is throttled,
// e.g. in RU). Vite fingerprints these woff2 into /assets and serves them
// same-origin; the per-weight files carry latin + latin-ext + cyrillic subsets,
// each unicode-range-gated so the browser only downloads what the page uses.
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/500.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles/theme.css'
import { App } from './App'
import { LangProvider } from './lib/i18n'
import { AuthProvider } from './lib/auth'
import { applyTheme, getInitialTheme } from './lib/theme'

// Apply the saved theme before first paint.
applyTheme(getInitialTheme())

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

// Note: StrictMode is intentionally omitted. Its double-invoked effects would
// connect/disconnect the LiveKit Room twice in development.
createRoot(container).render(
  <LangProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </LangProvider>,
)
