import { useEffect, useRef } from 'react'

import { $micLevel, clampMicLevel } from '@/store/voice-level'

/** How many recent frames the waveform keeps — about a second and a half. */
export const WAVEFORM_SAMPLES = 48

/**
 * Push one measured level into a fixed-length history, newest last. Pure, so
 * the scroll behaviour is testable without a canvas.
 */
export function pushWaveformSample(history: readonly number[], level: number, size = WAVEFORM_SAMPLES): number[] {
  const next = [...history, clampMicLevel(level)]

  return next.length > size ? next.slice(next.length - size) : next
}

/**
 * A scrolling waveform of the real microphone level: every bar is a level the
 * recorder actually measured, newest on the right. Closed or muted, it draws a
 * flat line and stops its loop — silence looks silent.
 */
export function VoiceWaveform({ active, className }: { active: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d') ?? null

    if (!canvas || !ctx) {
      return undefined
    }

    let history: number[] = []
    let frame = 0

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)

      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, 'rgba(0, 183, 255, 0.35)')
      gradient.addColorStop(0.5, 'rgba(0, 183, 255, 0.95)')
      gradient.addColorStop(1, 'rgba(124, 92, 255, 0.95)')
      ctx.fillStyle = gradient

      const step = width / WAVEFORM_SAMPLES
      const barWidth = Math.max(1.5, step * 0.5)
      const middle = height / 2
      const offset = WAVEFORM_SAMPLES - history.length

      for (let index = 0; index < WAVEFORM_SAMPLES; index += 1) {
        const level = index >= offset ? history[index - offset] : 0
        const half = Math.max(1, level * (height / 2 - 1))
        const x = index * step + (step - barWidth) / 2
        ctx.beginPath()
        ctx.roundRect?.(x, middle - half, barWidth, half * 2, barWidth / 2)

        if (!ctx.roundRect) {
          ctx.rect(x, middle - half, barWidth, half * 2)
        }

        ctx.fill()
      }
    }

    if (!active) {
      draw()

      return undefined
    }

    const loop = () => {
      history = pushWaveformSample(history, $micLevel.get())
      draw()
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(frame)
  }, [active])

  return <canvas aria-hidden="true" className={className} data-testid="jarvis-voice-waveform" ref={canvasRef} />
}
