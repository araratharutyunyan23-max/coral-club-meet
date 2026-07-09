import { useLang } from '../lib/i18n'

/** RU ⇄ EN language toggle, persisted to localStorage — mirrors the theme toggle. */
export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
      title={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
      aria-label="Language"
      className="chip-btn"
      style={{
        height: 32,
        minWidth: 34,
        padding: '0 9px',
        font: '700 12px/1 var(--mono)',
        letterSpacing: '.06em',
      }}
    >
      {lang === 'ru' ? 'RU' : 'EN'}
    </button>
  )
}
