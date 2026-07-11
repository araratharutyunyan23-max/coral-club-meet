import type { LocalVideoTrack } from 'livekit-client'
import type { BackgroundProcessorWrapper } from '@livekit/track-processors'

// Camera virtual backgrounds. Blur presets use MediaPipe segmentation; image
// presets composite the user over a generated brand gradient (or an uploaded
// photo). The heavy WASM/ML bundle is dynamically imported so it only loads when
// a background is actually applied.
//
// One processor is created per camera track and REUSED for every switch via
// `switchTo` — building a new processor per change spins up a fresh WebGL2
// context + MediaPipe segmenter each time, and the library never frees the GL
// context deterministically, so rapid switching used to leak past the browser's
// ~16-context cap and hang the tab. `switchTo` mutates the live pipeline in place.

export type BgId =
  | 'none'
  | 'blur-light'
  | 'blur-strong'
  | 'signal'
  | 'grad'
  | 'green'
  | 'reef'
  | 'studio'
  | 'office'
  | 'brand'
  | 'custom'

export type BgKind = 'none' | 'blur' | 'image'

/** A linear base + optional radial highlight, rendered to both the thumbnail
 *  swatch (CSS) and the 1280×720 image handed to VirtualBackground (canvas). */
interface Grad {
  angle: number // deg, for the CSS swatch
  stops: [number, string][] // canvas linear stops (pos 0..1)
  glow?: { x: number; y: number; r: number; color: string } // radial highlight (0..1)
}

export interface BgPreset {
  id: BgId
  kind: BgKind
  /** English label — also the i18n key. */
  label: string
  /** Sub-label for the blur strength ("light" / "strong"). */
  sub?: string
  /** Blur radius for kind === 'blur'. */
  blur?: number
  /** Brand-first preset (gets the coral dot in the picker). */
  brand?: boolean
  /** Gradient for kind === 'image'. */
  grad?: Grad
}

export const BACKGROUNDS: BgPreset[] = [
  { id: 'none', kind: 'none', label: 'None' },
  { id: 'blur-light', kind: 'blur', label: 'Blur', sub: 'light', blur: 6 },
  { id: 'blur-strong', kind: 'blur', label: 'Blur', sub: 'strong', blur: 14 },
  {
    id: 'signal', kind: 'image', label: 'Signal field', brand: true,
    grad: { angle: 158, stops: [[0, '#08171a'], [0.7, '#0b2327'], [1, '#0d2a2b']], glow: { x: 0.72, y: 0.2, r: 0.9, color: 'rgba(37,208,192,.36)' } },
  },
  {
    id: 'grad', kind: 'image', label: 'Brand gradient',
    grad: { angle: 135, stops: [[0, '#2fd4c4'], [0.52, '#0f9c8d'], [1, '#ff9077']] },
  },
  {
    id: 'green', kind: 'image', label: 'Greenery',
    grad: { angle: 160, stops: [[0, '#16321f'], [0.7, '#274b32'], [1, '#31543b']], glow: { x: 0.3, y: 0.28, r: 0.75, color: 'rgba(126,186,146,.4)' } },
  },
  {
    id: 'reef', kind: 'image', label: 'Reef',
    grad: { angle: 160, stops: [[0, '#0f2b33'], [0.74, '#164a58'], [1, '#1d6274']], glow: { x: 0.7, y: 0.26, r: 0.7, color: 'rgba(52,230,211,.28)' } },
  },
  {
    id: 'studio', kind: 'image', label: 'Neutral studio',
    grad: { angle: 160, stops: [[0, '#23272d'], [0.72, '#333a42'], [1, '#3d454e']], glow: { x: 0.5, y: 0.08, r: 0.8, color: 'rgba(255,255,255,.08)' } },
  },
  {
    id: 'office', kind: 'image', label: 'Light office',
    grad: { angle: 160, stops: [[0, '#eeece5'], [0.7, '#dde1da'], [1, '#d0d5cd']], glow: { x: 0.26, y: 0.24, r: 0.7, color: 'rgba(255,250,236,.85)' } },
  },
  {
    id: 'brand', kind: 'image', label: 'Brand backdrop', brand: true,
    grad: { angle: 150, stops: [[0, '#0b0e12'], [1, '#111820']], glow: { x: 0.84, y: 0.12, r: 0.85, color: 'rgba(37,208,192,.16)' } },
  },
]

/** The user's uploaded image is not a fixed preset — synthesize it on demand. */
const CUSTOM_PRESET: BgPreset = { id: 'custom', kind: 'image', label: 'Your image' }

export function bgById(id: BgId | undefined | null): BgPreset {
  if (id === 'custom') return CUSTOM_PRESET
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]
}

/** CSS gradient string for the picker thumbnail swatch. */
export function bgSwatchCss(p: BgPreset): string {
  if (!p.grad) return 'var(--surface-2)'
  const lin = `linear-gradient(${p.grad.angle}deg, ${p.grad.stops.map(([pos, c]) => `${c} ${Math.round(pos * 100)}%`).join(', ')})`
  if (!p.grad.glow) return lin
  const g = p.grad.glow
  return `radial-gradient(${Math.round(g.r * 100)}% ${Math.round(g.r * 100)}% at ${Math.round(g.x * 100)}% ${Math.round(g.y * 100)}%, ${g.color}, transparent 60%), ${lin}`
}

// Generated 1280×720 background images, cached per preset id (as data URLs).
const imageCache = new Map<BgId, string>()
function bgImageUrl(p: BgPreset): string {
  const cached = imageCache.get(p.id)
  if (cached) return cached
  const W = 1280, H = 720
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx || !p.grad) return ''
  // Linear base along the gradient angle.
  const rad = (p.grad.angle - 90) * (Math.PI / 180)
  const cx = W / 2, cy = H / 2
  const len = Math.abs(W * Math.cos(rad)) + Math.abs(H * Math.sin(rad))
  const dx = (Math.cos(rad) * len) / 2, dy = (Math.sin(rad) * len) / 2
  const lg = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  p.grad.stops.forEach(([pos, c]) => lg.addColorStop(pos, c))
  ctx.fillStyle = lg
  ctx.fillRect(0, 0, W, H)
  // Optional radial highlight.
  if (p.grad.glow) {
    const g = p.grad.glow
    const rg = ctx.createRadialGradient(g.x * W, g.y * H, 0, g.x * W, g.y * H, g.r * W)
    rg.addColorStop(0, g.color)
    rg.addColorStop(1, 'transparent')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)
  }
  const url = canvas.toDataURL('image/png')
  imageCache.set(p.id, url)
  return url
}

/** Whether the browser can run the background processors (needs canvas + the
 *  segmenter's WASM, which requires a reasonably modern browser). */
export function backgroundsSupported(): boolean {
  return typeof window !== 'undefined' && typeof document.createElement('canvas').getContext === 'function'
}

type BgMode =
  | { mode: 'disabled' }
  | { mode: 'background-blur'; blurRadius: number }
  | { mode: 'virtual-background'; imagePath: string }

/** The processor pipeline mode a preset maps to (image URL resolved here). */
function targetMode(p: BgPreset): BgMode {
  if (p.kind === 'none') return { mode: 'disabled' }
  if (p.kind === 'blur') return { mode: 'background-blur', blurRadius: p.blur ?? 10 }
  const imagePath = p.id === 'custom' ? (getCustomImage() ?? '') : bgImageUrl(p)
  return imagePath ? { mode: 'virtual-background', imagePath } : { mode: 'disabled' }
}

// One processor per camera track, reused across switches. WeakMap so a stopped/
// republished track (a new object) drops its entry and gets a fresh processor.
const processors = new WeakMap<LocalVideoTrack, BackgroundProcessorWrapper>()

/**
 * Apply a background preset to a local camera track. The first non-"none" apply
 * builds the processor once; every later change (including "none", which becomes
 * a cheap disabled pass-through) is an in-place `switchTo` — no new WebGL/ML
 * context, so rapid switching can't leak contexts and hang the tab. Throws if the
 * processor fails to initialise (caller falls back to "none").
 */
export async function applyBackground(track: LocalVideoTrack, id: BgId): Promise<void> {
  const target = targetMode(bgById(id))
  const cached = processors.get(track)
  // Only reuse if it's still the track's live processor (guards against an
  // external stopProcessor / a stale WeakMap entry from a replaced track).
  const active = cached && track.getProcessor() === cached ? cached : undefined

  if (active) {
    await active.switchTo(target)
    return
  }
  if (target.mode === 'disabled') {
    // Nothing running and nothing to show — make sure the track is clean.
    await track.stopProcessor()
    return
  }
  const { BackgroundProcessor } = await import('@livekit/track-processors')
  const processor = BackgroundProcessor(target)
  await track.setProcessor(processor)
  processors.set(track, processor)
}

/**
 * Fully tear down the processor on a track (WebGL context + segmenter). Only the
 * lobby preview needs this — before it hands the camera to the joining call. The
 * in-call track releases its processor when the track itself stops on leave.
 */
export async function releaseBackground(track: LocalVideoTrack): Promise<void> {
  processors.delete(track)
  try {
    await track.stopProcessor()
  } catch {
    /* ignore */
  }
}

// The user's uploaded background image, kept as a downscaled data URL. Persisted
// so it survives lobby → call and across sessions (best-effort; large uploads may
// exceed the localStorage quota, in which case it stays in memory for the session).
const CUSTOM_KEY = 'cc-bg-custom'
let customImage: string | null = null
let customLoaded = false
function loadCustom(): void {
  if (customLoaded) return
  customLoaded = true
  try {
    customImage = localStorage.getItem(CUSTOM_KEY)
  } catch {
    /* ignore */
  }
}

export function getCustomImage(): string | null {
  loadCustom()
  return customImage
}

export function setCustomImage(dataUrl: string): void {
  loadCustom()
  customImage = dataUrl
  try {
    localStorage.setItem(CUSTOM_KEY, dataUrl)
  } catch {
    /* quota exceeded / unavailable — keep the in-memory copy for this session */
  }
}

/**
 * Load an uploaded image file and return a downscaled (≤1280×720) JPEG data URL
 * suitable for VirtualBackground and for persisting. Throws on unreadable files.
 */
export async function prepareCustomImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1280 / bitmap.width, 720 / bitmap.height)
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}

const STORE_KEY = 'cc-bg'

/** Remembered background choice (carries lobby → call and across sessions). */
export function getSavedBg(): BgId {
  try {
    const v = localStorage.getItem(STORE_KEY)
    // "custom" is only valid while the uploaded image is still around.
    if (v === 'custom') return getCustomImage() ? 'custom' : 'none'
    if (v && BACKGROUNDS.some((b) => b.id === v)) return v as BgId
  } catch {
    /* ignore */
  }
  return 'none'
}

export function saveBg(id: BgId): void {
  try {
    localStorage.setItem(STORE_KEY, id)
  } catch {
    /* ignore */
  }
}
