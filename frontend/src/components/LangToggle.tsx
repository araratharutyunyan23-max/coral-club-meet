import { useLang } from '../lib/i18n'

/** RU ⇄ EN language toggle, persisted to localStorage — mirrors the theme toggle. */
export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
      title={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
      aria-label="Language"
      style={{
        height: 32,
        minWidth: 34,
        padding: '0 9px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-dim)',
        font: '700 12px/1 var(--mono)',
        letterSpacing: '.06em',
        cursor: 'pointer',
      }}
    >
      {lang === 'ru' ? 'RU' : 'EN'}
    </button>
  )
}
