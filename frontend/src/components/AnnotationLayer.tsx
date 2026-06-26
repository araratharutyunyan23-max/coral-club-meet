import { type PointerEvent, useEffect, useRef } from 'react'
import type { Point, Stroke } from '../lib/annotations'

interface Props {
  strokes: Stroke[]
  onStroke: (stroke: Stroke) => void
  active: boolean
  color?: string
}

/** Canvas overlay for drawing on a shared screen. Captures pointer input only
 *  when `active`; otherwise it lets clicks through to the video underneath. */
export function AnnotationLayer({ strokes, onStroke, active, color = '#ff7e63' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const current = useRef<Point[]>([])
  const drawing = useRef(false)

  const redraw = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const drawStroke = (points: Point[], col: string) => {
      if (points.length < 1) return
      ctx.strokeStyle = col
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      points.forEach((p, i) => {
        const x = p.x * canvas.width
        const y = p.y * canvas.height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    strokes.forEach((s) => drawStroke(s.points, s.color))
    if (current.current.length) drawStroke(current.current, color)
  }

  // Always call the latest redraw from the (mount-only) resize observer.
  const redrawRef = useRef(redraw)
  redrawRef.current = redraw

  // Keep the backing store sized to the element, and repaint on resize.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      redrawRef.current()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Repaint when the shared stroke list changes.
  useEffect(redraw, [strokes])

  const toPoint = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    drawing.current = true
    current.current = [toPoint(e)]
    redraw()
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!active || !drawing.current) return
    current.current.push(toPoint(e))
    redraw()
  }
  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    if (current.current.length > 1) {
      onStroke({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, color, points: current.current })
    }
    current.current = []
    redraw()
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : 'default',
        touchAction: 'none',
        borderRadius: 'var(--radius)',
      }}
    />
  )
}
