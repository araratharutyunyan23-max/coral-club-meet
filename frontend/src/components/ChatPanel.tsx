import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../lib/datachannel'
import { SendIcon } from '../lib/icons'
import { useT } from '../lib/i18n'

export function ChatPanel({ messages, onSend }: { messages: ChatMessage[]; onSend: (text: string) => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSend(text)
    setText('')
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
          value={text}
          onChange={(e) => setText(e.target.value)}
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: message.mine ? 'flex-end' : 'flex-start', gap: 3 }}>
      {!message.mine && <div style={{ fontSize: 11.5, color: 'var(--text-mute)', paddingLeft: 2 }}>{message.from}</div>}
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 11px',
          borderRadius: 10,
          fontSize: 13.5,
          lineHeight: 1.4,
          background: message.mine ? 'var(--teal-tint)' : 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
    </div>
  )
}
