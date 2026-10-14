import { useEffect, useRef } from 'react'

export type SignaturePadHandle = {
  getDataUrl: () => string | null
  clear: () => void
  hasInk: () => boolean
}

/** Touch-friendly signature canvas → PNG data URL via apiRef. */
export function SignaturePad({
  apiRef,
  onChange,
}: {
  apiRef: React.MutableRefObject<SignaturePadHandle | null>
  onChange?: (hasInk: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInkRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const paintBlank = () => {
      const ratio = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * ratio)
      canvas.height = Math.floor(h * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 2.5
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
    }
    paintBlank()

    const clear = () => {
      paintBlank()
      hasInkRef.current = false
      onChange?.(false)
    }
    const getDataUrl = () => (hasInkRef.current ? canvas.toDataURL('image/png') : null)
    const hasInk = () => hasInkRef.current
    apiRef.current = { getDataUrl, clear, hasInk }

    return () => {
      apiRef.current = null
    }
  }, [apiRef, onChange])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.preventDefault()
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hasInkRef.current) {
      hasInkRef.current = true
      onChange?.(true)
    }
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-44 block cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>
      <div className="flex justify-between items-center mt-2">
        <p className="text-xs text-gray-400">เซ็นด้วยนิ้วหรือปากกาในกรอบ</p>
        <button
          type="button"
          onClick={() => apiRef.current?.clear()}
          className="text-sm text-gray-500 underline"
        >
          ล้างลายเซ็น
        </button>
      </div>
    </div>
  )
}
