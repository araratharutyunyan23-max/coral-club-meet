import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { fetchToken } from '../lib/api'
import type { JoinInfo, Role } from '../lib/types'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { initialsFor } from '../components/Avatar'
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon } from '../lib/icons'

const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  fontSize: 13.5,
  outline: 'none',
  cursor: 'pointer',
}

export function Lobby({ room, role, onJoin }: { room: string; role: Role; onJoin: (info: JoinInfo) => void }) {
  const [name, setName] = useState('')
  const [camOn, setCamOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [blur, setBlur] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([])
  const [videoDeviceId, setVideoDeviceId] = useState('')
  const [audioDeviceId, setAudioDeviceId] = useState('')
  const [speakerDeviceId, setSpeakerDeviceId] = useState('')
  const [level, setLevel] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  function stopMeter() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevel(0)
  }

  function teardown() {
    stopMeter()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function startMeter(stream: MediaStream) {
    if (stream.getAudioTracks().length === 0) return
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      // Quantize to 5 discrete levels (0..4) — the meter only has 4 bars — and
      // bail when unchanged, so we don't re-render the lobby every frame.
      const bucket = Math.min(4, Math.round(Math.min(1, avg / 90) * 4))
      setLevel((prev) => (prev === bucket ? prev : bucket))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  async function refreshDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras(devices.filter((d) => d.kind === 'videoinput'))
      setMics(devices.filter((d) => d.kind === 'audioinput'))
      setSpeakers(devices.filter((d) => d.kind === 'audiooutput'))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let cancelled = false
    async function setup() {
      teardown()
      if (!camOn && !micOn) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn ? (videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true) : false,
          audio: micOn ? (audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true) : false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current && camOn) videoRef.current.srcObject = stream
        void refreshDevices()
        if (micOn) startMeter(stream)
      } catch {
        // permission denied / no device — joining is still allowed
      }
    }
    void setup()
    return () => {
      cancelled = true
    }
  }, [camOn, micOn, videoDeviceId, audioDeviceId])

  useEffect(() => () => teardown(), [])

  async function handleJoin() {
    if (!name.trim()) {
      setError('Enter your name')
      return
    }
    setBusy(true)
    setError(null)
    teardown()
    try {
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-')
      const identity = `${slug}-${Math.random().toString(36).slice(2, 7)}`
      const result = await fetchToken({ room, identity, name: name.trim(), role })
      onJoin({
        ...result,
        audioEnabled: micOn,
        videoEnabled: camOn,
        audioDeviceId: audioDeviceId || undefined,
        videoDeviceId: videoDeviceId || undefined,
        speakerDeviceId: speakerDeviceId || undefined,
        blur,
        krisp: true, // Krisp noise cancellation is always on (no lobby toggle).
        role,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join')
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', padding: '24px 32px', overflow: 'auto', background: 'var(--surround)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={34} />
        <ThemeToggle />
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'center', justifyContent: 'center', margin: 'auto 0', maxWidth: 1040, width: '100%', alignSelf: 'center', flexWrap: 'wrap' }}>
        {/* preview */}
        <div style={{ flex: '1.5 1 420px', minWidth: 320, position: 'relative', aspectRatio: '16 / 10', borderRadius: 18, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          {camOn ? (
            <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: blur ? 'blur(8px)' : undefined }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--teal-tint)', border: '1px solid rgba(37,208,192,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 600, color: 'var(--teal-soft)' }}>
                {initialsFor(name)}
              </div>
            </div>
          )}

          {/* mic meter */}
          {micOn && (
            <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', alignItems: 'flex-end', gap: 3, height: 18, padding: '5px 8px', background: 'rgba(10,11,13,.55)', backdropFilter: 'blur(6px)', borderRadius: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ width: 3, height: 14, borderRadius: 2, transformOrigin: 'bottom', transform: `scaleY(${level > i ? 1 : 0.3})`, background: level > i ? 'var(--teal)' : 'rgba(37,208,192,.4)', transition: 'transform .08s' }} />
              ))}
            </div>
          )}

          <div style={{ position: 'absolute', left: 16, bottom: 14, fontSize: 14, fontWeight: 500, color: 'var(--text)', textShadow: '0 1px 4px var(--surround)' }}>You</div>

          {/* preview controls */}
          <div style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
            <RoundToggle on={micOn} onClick={() => setMicOn((v) => !v)} onIcon={<MicIcon />} offIcon={<MicOffIcon />} />
            <RoundToggle on={camOn} onClick={() => setCamOn((v) => !v)} onIcon={<CameraIcon />} offIcon={<CameraOffIcon />} />
          </div>
        </div>

        {/* join card */}
        <div style={{ flex: '0 0 360px', maxWidth: '100%', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.01em' }}>Ready to join?</div>
          <div style={{ fontSize: 13, color: 'var(--text-mute)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room}</div>

          {/* Device pickers (camera / mic / speakers) and the Background blur
              toggle are temporarily hidden — мы к ним вернёмся позже. Joining
              uses the system default devices in the meantime. The supporting
              state and helpers (DeviceRow / ToggleRow / SpeakerGlyph) are kept
              in place for an easy restore. */}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: '100%', marginTop: 22, padding: '12px 14px', background: 'var(--fill-subtle)', border: '1px solid var(--border-strong)', borderRadius: 10, color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
          />
          {error &&<div style={{ color: 'var(--danger-soft)', fontSize: 13, marginTop: 10 }}>{error}</div>}

          <button onClick={handleJoin} disabled={busy} style={{ width: '100%', marginTop: 14, padding: 14, borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, var(--teal), var(--teal-bright))', color: '#04211e', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 10px 28px rgba(37,208,192,0.4), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
            {busy ? 'Joining…' : 'Join now'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeviceRow({ icon, value, onChange, devices, fallback }: { icon: ReactNode; value: string; onChange: (v: string) => void; devices: MediaDeviceInfo[]; fallback: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--fill-subtle)', border: '1px solid var(--border)', borderRadius: 10 }}>
      {icon}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="">{fallback}</option>
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${fallback} ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  )
}

function ToggleRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: '0 2px' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</span>
      <button onClick={onClick} title={label} style={{ width: 42, height: 24, borderRadius: 99, border: 'none', background: on ? 'var(--teal)' : 'var(--fill-hover)', position: 'relative', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: on ? '#fff' : '#cfd6dd', top: 3, left: on ? 21 : 3, transition: 'left .15s' }} />
      </button>
    </div>
  )
}

function RoundToggle({ on, onClick, onIcon, offIcon }: { on: boolean; onClick: () => void; onIcon: ReactNode; offIcon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ width: 46, height: 46, borderRadius: '50%', border: on ? '1px solid var(--border-strong)' : '1px solid rgba(239,75,67,.4)', background: on ? 'rgba(20,23,28,.8)' : 'rgba(239,75,67,.18)', color: on ? 'var(--text)' : 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    >
      {on ? onIcon : offIcon}
    </button>
  )
}

function SpeakerGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  )
}
