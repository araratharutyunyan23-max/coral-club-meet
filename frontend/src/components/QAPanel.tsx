import { type FormEvent, useState } from 'react'
import type { Question } from '../lib/qa'

export function QAPanel({ questions, onAsk, onUpvote }: { questions: Question[]; onAsk: (text: string) => void; onUpvote: (id: string) => void }) {
  const [text, setText] = useState('')
  const sorted = [...questions].sort((a, b) => b.votes - a.votes)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onAsk(text)
    setText('')
  }

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-mute)', fontSize: 13, lineHeight: 1.5 }}>
            No questions yet.
            <br />
            Ask the first one.
          </div>
        )}
        {sorted.map((q) => (
          <div key={q.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <button
              onClick={() => onUpvote(q.id)}
              disabled={q.voted || q.mine}
              title={q.mine ? 'Your question' : 'Upvote'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minWidth: 36,
                padding: '4px 0',
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
                background: q.voted ? 'var(--teal-tint)' : 'transparent',
                color: q.voted ? 'var(--teal-soft)' : 'var(--text-dim)',
                cursor: q.voted || q.mine ? 'default' : 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V6M6 12l6-6 6 6" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{q.votes}</span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--text)', wordBreak: 'break-word' }}>{q.text}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginTop: 4 }}>{q.mine ? 'You' : q.from}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question"
          style={{ flex: 1, height: 40, padding: '0 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)', fontSize: 13.5, outline: 'none' }}
        />
        <button type="submit" title="Ask" style={{ height: 40, padding: '0 14px', flex: '0 0 auto', borderRadius: 10, border: 'none', background: 'var(--teal)', color: '#04201d', fontSize: 13.5, fontWeight: 600 }}>
          Ask
        </button>
      </form>
    </>
  )
}
