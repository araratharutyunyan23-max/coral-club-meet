import { useState } from 'react'
import type { Room } from 'livekit-client'
import type { ChatMessage } from '../lib/datachannel'
import type { QAApi } from '../lib/qa'
import { CloseIcon } from '../lib/icons'
import { meetingUrl } from '../lib/rooms'
import { ChatPanel } from './ChatPanel'
import { ParticipantsPanel } from './ParticipantsPanel'
import { QAPanel } from './QAPanel'

export type PanelName = 'chat' | 'participants' | 'qa' | 'info'

const TITLES: Record<PanelName, string> = {
  chat: 'Chat',
  participants: 'People',
  qa: 'Q&A',
  info: 'Meeting info',
}

interface Props {
  room: Room
  panel: PanelName
  isHost: boolean
  messages: ChatMessage[]
  qa: QAApi
  onSend: (text: string) => void
  onClose: () => void
}

/**
 * Flat Meet-style sheet: slides in from the right and sits beside the (shrunk)
 * stage — it never floats over the video. Matches the inset stage's rounding.
 */
export function SidePanel({ room, panel, isHost, messages, qa, onSend, onClose }: Props) {
  return (
    <aside
      style={{
        position: 'absolute',
        top: 8,
        bottom: 92,
        right: 20,
        width: 326,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        zIndex: 35,
        animation: 'slidein 0.18s ease-out',
      }}
    >
      <div
        style={{
          height: 52,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{TITLES[panel]}</div>
        <button
          onClick={onClose}
          title="Close"
          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}
        >
          <CloseIcon size={18} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {panel === 'chat' && <ChatPanel messages={messages} onSend={onSend} />}
        {panel === 'participants' && <ParticipantsPanel room={room} isHost={isHost} />}
        {panel === 'qa' && <QAPanel questions={qa.questions} onAsk={qa.ask} onUpvote={qa.upvote} />}
        {panel === 'info' && <InfoPanel roomName={room.name} />}
      </div>
    </aside>
  )
}

/** Meeting info: the joining code and a copyable share link. */
function InfoPanel({ roomName }: { roomName: string }) {
  const [copied, setCopied] = useState(false)
  const link = meetingUrl(roomName)
  const copy = () => {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--text-mute)' }}>MEETING CODE</div>
        <div style={{ marginTop: 6, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{roomName}</div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--text-mute)' }}>SHARE LINK</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', padding: '9px 11px', background: 'var(--fill-subtle)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.replace(/^https?:\/\//, '')}
          </div>
          <button
            onClick={copy}
            style={{ flex: '0 0 auto', padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--teal-tint)', color: 'var(--teal-soft)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-mute)', lineHeight: 1.5 }}>Anyone with the link can join this meeting.</div>
    </div>
  )
}
