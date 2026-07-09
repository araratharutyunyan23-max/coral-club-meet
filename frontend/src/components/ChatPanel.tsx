import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../lib/datachannel'
import { SendIcon } from '../lib/icons'
import { useT } from '../lib/i18n'

// Turn bare URLs in a message into clickable links, safely: we build React <a>
// nodes (never dangerouslySetInnerHTML), and only match http(s):// or www. URLs,
// so a "javascript:" href can never be produced.
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
const LINK_STYLE = { color: 'var(--teal-soft)', textDecoration: 'underline', wordBreak: 'break-all' as const }

function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = new RegExp(URL_RE) // fresh lastIndex per call
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    let url = m[0]
    // Don't swallow trailing punctuation (sentence period, closing bracket, …).
    const trail = url.match(/[.,!?;:)\]}'"»]+$/)
    if (trail) url = url.slice(0, url.length - trail[0].length)
    if (!url) continue
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const href = url.startsWith('http') ? url : `https://${url}`
    nodes.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer nofollow" style={LINK_STYLE}>
        {url}
      </a>,
    )
    last = m.index + url.length
    re.lastIndex = last // resume just after the URL so trailing punctuation rejoins the text
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function ChatPanel({ messages, onSend, onSendImage }: { messages: ChatMessage[]; onSend: (text: string) => void; onSendImage: (file: File) => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSend(text)
    setText('')
  }

  // Send every image in a FileList (the attach picker).
  const sendFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((f) => {
      if (f.type.startsWith('image/')) onSendImage(f)
    })
  }

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-mute)', fontSize: 13, lineHeight: 1.5 }}>
            No messages yet.
            <br />
            Say hello 👋
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            sendFiles(e.target.files)
            e.target.value = '' // allow re-selecting the same file
          }}
        />
        <button
          type="button"
          title={t('Attach image')}
          aria-label={t('Attach image')}
          onClick={() => fileRef.current?.click()}
          style={{
            width: 40,
            height: 40,
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            border: '1px solid var(--border-strong)',
            background: 'transparent',
            color: 'var(--text-dim)',
          }}
        >
          <PaperclipIcon size={18} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // Screenshots are pasted (Ctrl+V) — grab any image on the clipboard.
            const imgs = Array.from(e.clipboardData.items).filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
            if (imgs.length === 0) return
            e.preventDefault()
            imgs.forEach((it) => {
              const f = it.getAsFile()
              if (f) onSendImage(f)
            })
          }}
          placeholder={t('Message everyone')}
          style={{
            flex: 1,
            height: 40,
            padding: '0 12px',
            borderRadius: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text)',
            fontSize: 13.5,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          title="Send"
          style={{
            width: 40,
            height: 40,
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            border: 'none',
            background: 'var(--teal)',
            color: '#04201d',
          }}
        >
          <SendIcon size={18} />
        </button>
      </form>
    </>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const img = message.image
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: message.mine ? 'flex-end' : 'flex-start', gap: 3 }}>
      {!message.mine && <div style={{ fontSize: 11.5, color: 'var(--text-mute)', paddingLeft: 2 }}>{message.from}</div>}
      <div
        style={{
          maxWidth: '85%',
          padding: img ? 3 : '8px 11px',
          borderRadius: 10,
          fontSize: 13.5,
          lineHeight: 1.4,
          background: message.mine ? 'var(--teal-tint)' : 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          wordBreak: 'break-word',
        }}
      >
        {img ? (
          <a href={img.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
            <img
              src={img.url}
              alt={img.name || 'image'}
              style={{ display: 'block', maxWidth: '100%', maxHeight: 300, borderRadius: 7, cursor: 'zoom-in' }}
            />
          </a>
        ) : (
          linkify(message.text)
        )}
      </div>
    </div>
  )
}

function PaperclipIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
    </svg>
  )
}
