import { useCallback, useEffect, useState } from 'react'
import { type RemoteParticipant, type Room, RoomEvent, Track } from 'livekit-client'

// Live speech-to-text (offline, on-device). Each participant transcribes their
// OWN microphone with Vosk (a WASM Kaldi model that runs entirely in the browser
// — no cloud, works where Google's speech backend is blocked), and broadcasts the
// finalized text over the same LiveKit data channel the chat uses. Everyone
// accumulates a shared, speaker-attributed transcript that can be saved.

export interface TranscriptSegment {
  id: string
  from: string
  identity: string
  text: string
  ts: number
  mine: boolean
}

const TOPIC = 'transcript'
const MODEL_URL = '/vosk/model-ru.tar.gz'
const enc = new TextEncoder()
const dec = new TextDecoder()

// Minimal shape of the vosk-browser API we use (avoids leaking its worker types).
interface Recognizer {
  on(event: 'result', cb: (m: { result: { text?: string } }) => void): void
  on(event: 'partialresult', cb: (m: { result: { partial?: string } }) => void): void
  acceptWaveform(buffer: AudioBuffer): void
  remove(): void
}
interface VoskModel {
  KaldiRecognizer: new (sampleRate: number) => Recognizer
}

// One model per tab, loaded lazily on first use and kept for re-enabling. Vosk
// runs it in a Web Worker; the ~45 MB model streams once from our own origin and
// is then browser-cached.
let modelPromise: Promise<VoskModel> | null = null
function loadModel(): Promise<VoskModel> {
  if (!modelPromise) {
    // Drop a rejected promise so a transient failure (network blip, 404) can be
    // retried — otherwise the cached rejection would brick STT for the tab.
    modelPromise = import('vosk-browser')
      .then((v) => v.createModel(MODEL_URL) as unknown as Promise<VoskModel>)
      .catch((e) => {
        modelPromise = null
        throw e
      })
  }
  return modelPromise
}

interface Pipe {
  ctx: AudioContext
  src: MediaStreamAudioSourceNode
  proc: ScriptProcessorNode
  rec: Recognizer
}

export interface Transcription {
  /** STT is running on my mic. */
  enabled: boolean
  /** Model is (down)loading / starting. */
  loading: boolean
  /** True if the model failed to load (e.g. unsupported browser). */
  failed: boolean
  segments: TranscriptSegment[]
  /** My current in-progress (not yet finalized) words. */
  partial: string
  toggle: () => void
  clear: () => void
}

export function useTranscription(room: Room): Transcription {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [partial, setPartial] = useState('')

  // Receive remote transcript segments (always on, even when my STT is off).
  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC) return
      try {
        const d = JSON.parse(dec.decode(payload)) as { id: string; text: string; ts: number }
        if (!d.text) return
        setSegments((prev) => [
          ...prev,
          {
            id: d.id,
            from: participant?.name || participant?.identity || 'Guest',
            identity: participant?.identity || 'guest',
            text: d.text,
            ts: d.ts,
            mine: false,
          },
        ])
      } catch {
        /* ignore malformed payloads */
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room])

  // Local STT pipeline: mic → AudioContext → Vosk recognizer. Rebuilt whenever the
  // local mic (re)publishes so mute/unmute and device switches keep working.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let pipe: Pipe | null = null

    const tearPipe = () => {
      if (!pipe) return
      try {
        pipe.proc.disconnect()
        pipe.src.disconnect()
        pipe.proc.onaudioprocess = null
        pipe.rec.remove()
        void pipe.ctx.close()
      } catch {
        /* ignore */
      }
      pipe = null
    }

    const build = async () => {
      const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack
      if (!micTrack || cancelled || pipe) return
      let model: VoskModel
      try {
        setLoading(true)
        model = await loadModel()
      } catch {
        if (!cancelled) {
          setFailed(true)
          setEnabled(false)
        }
        return
      } finally {
        if (!cancelled) setLoading(false)
      }
      // Re-check AFTER the await: a concurrent build (e.g. a mic rewire during the
      // model download) may have already set up the pipe — don't orphan a second
      // AudioContext + recognizer that teardown would never see.
      if (cancelled || pipe) return
      const ctx = new AudioContext()
      const rec = new model.KaldiRecognizer(ctx.sampleRate)
      rec.on('result', (m) => {
        const text = (m.result.text || '').trim()
        setPartial('')
        if (!text) return
        const ts = Date.now()
        const id = `${room.localParticipant.identity}-${ts}`
        setSegments((prev) => [
          ...prev,
          { id, from: room.localParticipant.name || room.localParticipant.identity, identity: room.localParticipant.identity, text, ts, mine: true },
        ])
        void room.localParticipant
          .publishData(enc.encode(JSON.stringify({ id, text, ts })), { reliable: true, topic: TOPIC })
          .catch(() => {})
      })
      rec.on('partialresult', (m) => setPartial((m.result.partial || '').trim()))
      const src = ctx.createMediaStreamSource(new MediaStream([micTrack]))
      // ScriptProcessor is deprecated but universally available; we never write to
      // its output buffer, so connecting it to the destination stays silent (no
      // feedback) while still driving onaudioprocess.
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => {
        try {
          rec.acceptWaveform(e.inputBuffer)
        } catch {
          /* transient */
        }
      }
      src.connect(proc)
      proc.connect(ctx.destination)
      pipe = { ctx, src, proc, rec }
    }

    void build()
    // Rewire when the MIC specifically (re)appears (unmute / device switch / late
    // mic-on). Ignore camera/screen-share publishes, which must not tear down or
    // rebuild the audio pipeline mid-utterance.
    const isMic = (pub?: { source?: Track.Source }) => !pub || pub.source === Track.Source.Microphone
    const rewire = (pub?: { source?: Track.Source }) => {
      if (!isMic(pub)) return
      tearPipe()
      void build()
    }
    const onUnpub = (pub?: { source?: Track.Source }) => {
      if (isMic(pub)) tearPipe()
    }
    room.on(RoomEvent.LocalTrackPublished, rewire)
    room.on(RoomEvent.LocalTrackUnpublished, onUnpub)

    return () => {
      cancelled = true
      room.off(RoomEvent.LocalTrackPublished, rewire)
      room.off(RoomEvent.LocalTrackUnpublished, onUnpub)
      tearPipe()
      setPartial('')
    }
  }, [enabled, room])

  const toggle = useCallback(() => {
    setFailed(false)
    setEnabled((on) => !on)
  }, [])

  const clear = useCallback(() => setSegments([]), [])

  return { enabled, loading, failed, segments, partial, toggle, clear }
}

/** Flatten the transcript into a plain-text meeting record for download. */
export function transcriptToText(room: string, segments: TranscriptSegment[]): string {
  const head = `Транскрипт встречи ${room}\n\n`
  const body = segments
    .map((s) => {
      const t = new Date(s.ts)
      const hh = String(t.getHours()).padStart(2, '0')
      const mm = String(t.getMinutes()).padStart(2, '0')
      return `[${hh}:${mm}] ${s.from}: ${s.text}`
    })
    .join('\n')
  return head + body + '\n'
}
