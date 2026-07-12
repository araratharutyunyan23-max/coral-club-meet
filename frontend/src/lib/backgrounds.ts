import type { LocalVideoTrack } from 'livekit-client'
import type { BackgroundProcessorWrapper } from '@livekit/track-processors'

// Camera virtual backgrounds. Blur presets use MediaPipe segmentation; image
// presets composite the user over a generated brand gradient. The heavy WASM/ML
// bundle is dynamically imported so it only loads when a background is applied.
//
// One processor is created per camera track and REUSED for every switch via
// `switchTo` — building a new processor per change spins up a fresh WebGL2
// context + MediaPipe segmenter each time, and the library never frees the GL
// context deterministically, so rapid switching used to leak past the browser's
// ~16-context cap and hang the tab. `switchTo` mutates the live pipeline in place.

export type BgId = 'none' | 'blur-strong' | 'green' | 'office'

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
  { id: 'blur-strong', kind: 'blur', label: 'Blur', sub: 'strong', blur: 14 },
  {
    id: 'green', kind: 'image', label: 'Greenery',
    grad: { angle: 160, stops: [[0, '#16321f'], [0.7, '#274b32'], [1, '#31543b']], glow: { x: 0.3, y: 0.28, r: 0.75, color: 'rgba(126,186,146,.4)' } },
  },
  {
    id: 'office', kind: 'image', label: 'Light office',
    grad: { angle: 160, stops: [[0, '#eeece5'], [0.7, '#dde1da'], [1, '#d0d5cd']], glow: { x: 0.26, y: 0.24, r: 0.7, color: 'rgba(255,250,236,.85)' } },
  },
]

export function bgById(id: BgId | undefined | null): BgPreset {
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
  const imagePath = bgImageUrl(p)
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

const STORE_KEY = 'cc-bg'

/** Remembered background choice (carries lobby → call and across sessions). */
export function getSavedBg(): BgId {
  try {
    const v = localStorage.getItem(STORE_KEY)
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
