import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { type Room, RoomEvent } from 'livekit-client'
import { useRoomEvents, useIsMobile } from '../lib/hooks'
import { useT } from '../lib/i18n'
import type { PanelName } from './SidePanel'
import type { CallView } from '../lib/types'
import type { Moment } from '../lib/moment'
import { MomentComposer } from './MomentComposer'
import {
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  HandIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  MoreIcon,
  PeopleIcon,
  ReactIcon,
  RecordIcon,
  ScreenShareIcon,
} from '../lib/icons'

const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '🙌', '😮', '🤔', '👎', '😢', '😠']

const LAYOUTS: { id: CallView; label: string }[] = [
  { id: 'tiled', label: 'Tiled' },
  { id: 'sidebar', label: 'Sidebar' },
]

const CONTROL_EVENTS = [
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.ParticipantAttributesChanged,
] as const

interface Props {
  room: Room
  activePanel: PanelName | null
  onTogglePanel: (panel: PanelName) => void
  unread: number
  view: CallView
  onViewChange: (v: CallView) => void
  sharing?: boolean
  isHost?: boolean
  recording?: boolean
  onToggleRecord?: () => void
  onReaction?: (emoji: string) => void
  onOpenPip?: () => void
  onLeave: () => void
  /** Host-only: broadcast a Moment of Recognition. Absent for participants. */
  onCelebrate?: (m: Omit<Moment, 'id'>) => void
  /** Open the "move people aside" picker (any participant). */
  onMoveAside?: () => void
  /** Open the "leave a commitment" composer (any participant). */
  onLeaveCommitment?: () => void
}

/**
 * Flat Meet-style control bar: a centered cluster (mic & camera with device
 * pickers · present · reactions · raise hand · captions · more · end-call) and a
 * bottom-right corner-chrome group (chat · people). No glass.
 */
export function MeetControls({ room, activePanel, onTogglePanel, unread, view, onViewChange, sharing = false, isHost = false, recording = false, onToggleRecord, onReaction, onOpenPip, onLeave, onCelebrate, onMoveAside, onLeaveCommitment }: Props) {
  useRoomEvents(room, CONTROL_EVENTS)
  const isMobile = useIsMobile()
  const t = useT()
  const [popover, setPopover] = useState<null | 'reactions' | 'more' | 'mic' | 'cam'>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [confirmStopShare, setConfirmStopShare] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const lp = room.localParticipant

  const micOn = lp.isMicrophoneEnabled
  const camOn = lp.isCameraEnabled
  const screenOn = lp.isScreenShareEnabled
  const handRaised = !!lp.attributes?.handRaised

  // Surface getUserMedia failures (denied permission, or in-app browsers like
  // Telegram/Instagram that block media) instead of silently swallowing them.
  const mediaFail = (what: string) => () =>
    setMediaError(t("Couldn't turn on the {device}. Allow access in the browser, or open the link in Safari/Chrome — in-app browsers (Telegram, Instagram…) often block the camera & mic.", { device: what }))
  const toggleMic = () => {
    setMediaError(null)
    void lp.setMicrophoneEnabled(!micOn).catch(mediaFail(t('microphone')))
  }
  const toggleCam = () => {
    setMediaError(null)
    void lp.setCameraEnabled(!camOn).catch(mediaFail(t('camera')))
  }
  const toggleScreen = () => void lp.setScreenShareEnabled(!screenOn).catch(() => {})
  // Store the raise time so everyone can show the queue order (1, 2, 3…).
  const toggleHand = () => void lp.setAttributes({ handRaised: handRaised ? '' : String(Date.now()) }).catch(() => {})
  // Switch to the post-call screen immediately; unmounting CallRoom tears the
  // LiveKit room down in the background, so the tap never waits on disconnect().
  const leave = () => onLeave()
  const close = () => setPopover(null)
  // Copy the meeting link (the room URL) to the clipboard, with a fallback for
  // browsers without the async clipboard API.
  const copyLink = () => {
    const url = window.location.href
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(url).catch(() => {})
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  // If the share ends another way (e.g. the browser's native "Stop sharing"
  // bar) while the confirm dialog is open, close it — otherwise its button
  // would toggle the share back ON.
  useEffect(() => {
    if (!screenOn && confirmStopShare) setConfirmStopShare(false)
  }, [screenOn, confirmStopShare])

  // Auto-dismiss the media-error toast.
  useEffect(() => {
    if (!mediaError) return
    const t = window.setTimeout(() => setMediaError(null), 7000)
    return () => window.clearTimeout(t)
  }, [mediaError])

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, zIndex: 30, fontFamily: 'var(--font)' }}>
      {showComposer && onCelebrate && (
        <MomentComposer room={room} onCelebrate={onCelebrate} onClose={() => setShowComposer(false)} />
      )}
      {/* Centered cluster */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8 }}>
        <SplitButton
          compact={isMobile}
          danger={!micOn}
          onMain={toggleMic}
          title={micOn ? t('Mute') : t('Unmute')}
          icon={micOn ? <MicIcon /> : <MicOffIcon />}
          onChevron={() => setPopover((p) => (p === 'mic' ? null : 'mic'))}
          popover={popover === 'mic' ? <DevicePicker room={room} kind="audioinput" onClose={close} /> : null}
        />
        <SplitButton
          compact={isMobile}
          danger={!camOn}
          onMain={toggleCam}
          title={camOn ? t('Turn off camera') : t('Turn on camera')}
          icon={camOn ? <CameraIcon /> : <CameraOffIcon />}
          onChevron={() => setPopover((p) => (p === 'cam' ? null : 'cam'))}
          popover={popover === 'cam' ? <DevicePicker room={room} kind="videoinput" onClose={close} /> : null}
        />

        <Divider compact={isMobile} />

        <RoundBtn
          title={screenOn ? t('You are presenting — click to stop') : sharing ? t('Someone is already presenting') : t('Present now')}
          accent={screenOn}
          disabled={sharing && !screenOn}
          onClick={() => (screenOn ? setConfirmStopShare(true) : toggleScreen())}
        >
          <ScreenShareIcon />
        </RoundBtn>
        <div style={{ position: 'relative' }}>
          <RoundBtn title={t('Reactions')} active={popover === 'reactions'} onClick={() => setPopover((p) => (p === 'reactions' ? null : 'reactions'))}><ReactIcon /></RoundBtn>
          {popover === 'reactions' && (
            <Popover>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 40px)', gap: 4 }}>
                {REACTIONS.map((emoji) => (
                  <button key={emoji} onClick={() => onReaction?.(emoji)} title={t('Send {emoji}', { emoji })} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer' }}>{emoji}</button>
                ))}
              </div>
            </Popover>
          )}
        </div>
        <RoundBtn title={t('Raise hand')} accent={handRaised} coral onClick={toggleHand}><HandIcon /></RoundBtn>
        <div style={{ position: 'relative' }}>
          <RoundBtn title={t('More options')} active={popover === 'more'} onClick={() => setPopover((p) => (p === 'more' ? null : 'more'))}><MoreIcon /></RoundBtn>
          {popover === 'more' && (
            <Popover align="center">
              <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={copyLink}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: copied ? 'var(--teal-tint)' : 'var(--fill-subtle)', color: copied ? 'var(--teal-soft)' : 'var(--text)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  {copied ? t('Link copied') : t('Copy link')}
                </button>
                {onMoveAside && (
                  <button
                    onClick={() => { onMoveAside(); close() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--teal-tint)', color: 'var(--text)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3" /><path d="M3.5 20a6 6 0 0 1 11 0" /><path d="M15 8l4 4-4 4" /><path d="M19 12h-6" /></svg>
                    {t('Move people aside')}
                  </button>
                )}
                {onLeaveCommitment && (
                  <button
                    onClick={() => { onLeaveCommitment(); close() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--fill-subtle)', color: 'var(--text)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal-soft)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L20 6" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    {t('Leave a commitment')}
                  </button>
                )}
                {isHost && onCelebrate && (
                  <button
                    onClick={() => { setShowComposer(true); close() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'rgba(255,126,99,.13)', color: 'var(--text)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 3 6.5 8" /><path d="M15.5 3 17.5 8" /><circle cx="12" cy="15" r="6" /><path d="M9.6 15.2 11.2 16.8 14.4 13.6" /></svg>
                    {t('Recognise someone')}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.08em', color: 'var(--coral)' }}>{t('HOST')}</span>
                  </button>
                )}
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 4px' }} />
                {isMobile && (
                  <>
                    <button
                      onClick={() => { onTogglePanel('chat'); close() }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--fill-subtle)', color: 'var(--text)' }}
                    >
                      <ChatIcon size={16} />
                      {t('Chat')}
                      {unread > 0 && (
                        <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--coral)', color: '#241008', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 9 ? '9+' : unread}</span>
                      )}
                    </button>
                    <button
                      onClick={() => { onTogglePanel('participants'); close() }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--fill-subtle)', color: 'var(--text)' }}
                    >
                      <PeopleIcon size={16} />
                      {t('People')}
                    </button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 4px' }} />
                  </>
                )}
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-mute)', padding: '2px 8px 6px' }}>{t('LAYOUT')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {LAYOUTS.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => { onViewChange(id); close() }}
                      style={{ padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: view === id ? 600 : 500, background: view === id ? 'var(--teal-tint)' : 'transparent', color: view === id ? 'var(--teal-soft)' : 'var(--text)' }}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                {onOpenPip && (
                  <button
                    onClick={() => { onOpenPip(); close() }}
                    style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--fill-subtle)', color: 'var(--text)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal-soft)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><rect x="12" y="11" width="7" height="5" rx="1" fill="var(--teal-soft)" stroke="none" /></svg>
                    {t('Mini window')}
                  </button>
                )}
                {isHost && (
                  <button
                    disabled
                    title={t("Recording isn't available on this server yet")}
                    style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderRadius: 9, border: 'none', cursor: 'not-allowed', fontSize: 13, fontWeight: 600, background: 'var(--fill-subtle)', color: 'var(--text-mute)', opacity: 0.55 }}
                  >
                    <RecordIcon size={16} />
                    {t('Record meeting')}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', color: 'var(--text-mute)' }}>{t('SOON')}</span>
                  </button>
                )}
              </div>
            </Popover>
          )}
        </div>

        <Divider compact={isMobile} />

        <button onClick={leave} title={t('Leave call')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 54 : 60, height: 46, borderRadius: 23, background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <LeaveIcon />
        </button>
      </div>

      {/* Bottom-right corner chrome (desktop only — on mobile Chat/People live in the ⋮ menu). */}
      {!isMobile && (
        <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <CornerBtn title={t('Chat')} active={activePanel === 'chat'} badge={unread} onClick={() => onTogglePanel('chat')}><ChatIcon size={19} /></CornerBtn>
          <CornerBtn title={t('People')} active={activePanel === 'participants'} onClick={() => onTogglePanel('participants')}><PeopleIcon size={19} /></CornerBtn>
        </div>
      )}

      {mediaError && (
        <div style={{ position: 'fixed', left: '50%', bottom: 100, transform: 'translateX(-50%)', zIndex: 45, maxWidth: 'min(92vw, 440px)', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', background: 'rgba(239,75,67,.16)', border: '1px solid rgba(239,75,67,.4)', borderRadius: 12, color: '#ff8a82', fontSize: 13, lineHeight: 1.4, boxShadow: '0 14px 40px rgba(0,0,0,.4)' }}>
          <span>{mediaError}</span>
          <button onClick={() => setMediaError(null)} title={t('Dismiss')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1, flex: '0 0 auto' }}>✕</button>
        </div>
      )}

      {confirmStopShare && (
        <div
          onClick={() => setConfirmStopShare(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380, maxWidth: '90vw', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,.5)' }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{t('Stop sharing your screen?')}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>{t('Others will no longer see your screen.')}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={() => setConfirmStopShare(false)}
                style={{ padding: '10px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('Cancel')}
              </button>
              <button
                onClick={() => { void lp.setScreenShareEnabled(false).catch(() => {}); setConfirmStopShare(false) }}
                style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('Stop sharing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function controlColors() {
  return { neutralBg: 'var(--fill-hover)', neutral: 'var(--text)', plain: 'var(--text-dim)' }
}

/** Mic / camera: a main toggle joined to a device-picker chevron. */
function SplitButton({ compact, danger, icon, title, onMain, onChevron, popover }: { compact?: boolean; danger?: boolean; icon: ReactNode; title: string; onMain: () => void; onChevron: () => void; popover: ReactNode }) {
  const t = useT()
  const { neutralBg, neutral } = controlColors()
  const bg = danger ? 'rgba(239,75,67,.18)' : neutralBg
  const color = danger ? 'var(--danger-soft)' : neutral
  // On mobile we drop the device-picker chevron + divider so each control is a
  // single ~44px round toggle, keeping the whole cluster in one row.
  if (compact) {
    return (
      <button onClick={onMain} title={title} style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 23, border: 'none', background: bg, color, cursor: 'pointer' }}>{icon}</button>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 46, borderRadius: 23, overflow: 'hidden', background: bg, color }}>
        <button onClick={onMain} title={title} style={{ width: 48, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>{icon}</button>
        <div style={{ width: 1, height: 22, background: 'var(--border-strong)' }} />
        <button onClick={onChevron} title={t('Choose device')} style={{ width: 26, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-mute)', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {popover && <Popover>{popover}</Popover>}
    </div>
  )
}

function RoundBtn({ active, accent, coral, danger, disabled, onClick, title, children }: { active?: boolean; accent?: boolean; coral?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  // Non-coral accent (screen-share active) is a solid teal fill so "you are
  // presenting" is unmistakable; coral accent (raise hand) stays a soft tint.
  const bg = danger ? 'rgba(239,75,67,.18)' : accent ? (coral ? 'rgba(255,126,99,.18)' : 'var(--teal)') : active ? 'var(--fill-hover)' : 'transparent'
  const color = danger ? 'var(--danger-soft)' : accent ? (coral ? 'var(--coral)' : '#04211e') : active ? 'var(--text)' : 'var(--text-dim)'
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 23, border: 'none', background: bg, color, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.38 : 1 }}>{children}</button>
  )
}

function CornerBtn({ active, badge, onClick, title, children }: { active: boolean; badge?: number; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ position: 'relative', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 21, border: 'none', background: active ? 'var(--teal-tint)' : 'transparent', color: active ? 'var(--teal-soft)' : 'var(--text-dim)', cursor: 'pointer' }}>
      {children}
      {badge ? (
        <span style={{ position: 'absolute', top: 3, right: 3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--coral)', color: '#241008', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 9 ? '9+' : badge}</span>
      ) : null}
    </button>
  )
}

function Popover({ children, align = 'center' }: { children: ReactNode; align?: 'center' }) {
  const pos: CSSProperties = align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : {}
  return (
    <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', ...pos, padding: 8, background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 14px 44px rgba(0,0,0,.35)', zIndex: 40 }}>
      {children}
    </div>
  )
}

function DevicePicker({ room, kind, onClose }: { room: Room; kind: 'audioinput' | 'videoinput'; onClose: () => void }) {
  const t = useT()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setDevices(all.filter((d) => d.kind === kind)))
      .catch(() => {})
  }, [kind])

  const pick = (id: string) => {
    setActiveId(id)
    void room.switchActiveDevice(kind, id).catch(() => {})
    onClose()
  }

  return (
    <div ref={ref} style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-mute)', padding: '2px 8px 6px' }}>{kind === 'audioinput' ? t('MICROPHONE') : t('CAMERA')}</div>
      {devices.length === 0 && <div style={{ padding: '6px 8px', fontSize: 12.5, color: 'var(--text-mute)' }}>{t('No devices found')}</div>}
      {devices.map((d, i) => (
        <button
          key={d.deviceId || i}
          onClick={() => pick(d.deviceId)}
          style={{ textAlign: 'left', padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, background: activeId === d.deviceId ? 'var(--teal-tint)' : 'transparent', color: activeId === d.deviceId ? 'var(--teal-soft)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
        >
          {d.label || (kind === 'audioinput' ? t('Microphone {n}', { n: i + 1 }) : t('Camera {n}', { n: i + 1 }))}
        </button>
      ))}
    </div>
  )
}

function Divider({ compact }: { compact?: boolean }) {
  return <div style={{ width: 1, height: compact ? 22 : 26, background: 'var(--border-strong)', margin: compact ? '0 1px' : '0 3px' }} />
}
