import type { LocalVideoTrack } from 'livekit-client'

// Camera virtual backgrounds. "None" clears any processor; the blur presets use
// MediaPipe segmentation (BackgroundBlur); the image presets composite the user
// over a generated brand gradient (VirtualBackground). The heavy WASM/ML bundle
// is dynamically imported so it only loads when a background is actually applied.

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

/**
 * Apply a background preset to a local camera track. Clears the processor for
 * "none", swaps to blur/virtual-background otherwise. Safe to call repeatedly to
 * switch backgrounds. Throws if the processor fails to initialise (caller falls
 * back to "none" and surfaces the "unavailable" state).
 */
export async function applyBackground(track: LocalVideoTrack, id: BgId): Promise<void> {
  const p = bgById(id)
  if (p.kind === 'none') {
    await track.stopProcessor()
    return
  }
  const { BackgroundBlur, VirtualBackground } = await import('@livekit/track-processors')
  if (p.kind === 'blur') {
    await track.setProcessor(BackgroundBlur(p.blur ?? 10))
    return
  }
  const url = bgImageUrl(p)
  if (!url) {
    // Couldn't render the background image (no 2D canvas) — leave the camera clean.
    await track.stopProcessor()
    return
  }
  await track.setProcessor(VirtualBackground(url))
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
