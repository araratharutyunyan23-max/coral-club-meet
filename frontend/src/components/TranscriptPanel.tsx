import { useEffect, useRef } from 'react'
import { hueFor } from './Avatar'
import { useT } from '../lib/i18n'
import { type Transcription, transcriptToText } from '../lib/transcription'

/**
 * Live meeting transcript. Each participant toggles recognition of their OWN mic
 * (offline Vosk in the browser); finalized lines from everyone who has it on
 * accumulate here, attributed by speaker, and can be downloaded as a .txt.
 */
export function TranscriptPanel({ transcription, roomName }: { transcription: Transcription; roomName: string }) {
  const t = useT()
  const { enabled, loading, failed, segments, partial, toggle, clear } = transcription
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the newest line in view as the transcript grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [segments, partial])

  const download = () => {
    const blob = new Blob([transcriptToText(roomName, segments)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${roomName}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Control row: my-recognition toggle + download */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={toggle}
          className="chip-btn"
          style={{
            height: 34,
            padding: '0 14px',
            font: '600 12.5px/1 var(--font)',
            background: enabled ? 'var(--teal-tint)' : undefined,
            color: enabled ? 'var(--teal-soft)' : undefined,
            borderColor: enabled ? 'transparent' : undefined,
          }}
        >
          {loading ? t('Loading…') : enabled ? `● ${t('Recognizing my speech')}` : t('Recognize my speech')}
        </button>
        <button
          onClick={download}
          disabled={segments.length === 0}
          className="chip-btn"
          title={t('Download .txt')}
          style={{ height: 34, width: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
          </svg>
        </button>
        {segments.length > 0 && (
          <button onClick={clear} className="chip-btn" title={t('Clear')} style={{ height: 34, width: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" />
            </svg>
          </button>
        )}
      </div>

      {failed && (
        <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--danger-soft, #ff8a82)' }}>
          {t('Speech recognition failed to start on this browser.')}
        </div>
      )}

      {/* Transcript stream */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segments.length === 0 && !partial ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-mute)', fontSize: 13, lineHeight: 1.5, maxWidth: '26ch' }}>
            {enabled ? t('Listening… start speaking.') : t('Turn on “Recognize my speech” to add your words. Everyone who enables it appears here.')}
          </div>
        ) : (
          <>
            {segments.map((s) => (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: `hsl(${hueFor(s.identity)} 70% 62%)` }}>
                    {s.mine ? t('You') : s.from}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>
                    {new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--text)' }}>{s.text}</div>
              </div>
            ))}
            {partial && (
              <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--text-mute)', fontStyle: 'italic' }}>{partial}…</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
