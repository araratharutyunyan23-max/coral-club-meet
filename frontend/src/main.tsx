import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { App } from './App'
import { LangProvider } from './lib/i18n'
import { applyTheme, getInitialTheme } from './lib/theme'

// Apply the saved theme before first paint.
applyTheme(getInitialTheme())

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

// Note: StrictMode is intentionally omitted. Its double-invoked effects would
// connect/disconnect the LiveKit Room twice in development.
createRoot(container).render(
  <LangProvider>
    <App />
  </LangProvider>,
)
