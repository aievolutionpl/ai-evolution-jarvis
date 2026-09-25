import { useEffect, useRef } from 'react'

import { $micLevel, clampMicLevel } from '@/store/voice-level'

import { ParticleOrb } from './particle-orb'
import { drawPlasmaFrame, type PlasmaSurface, type PlasmaTone } from './plasma'

export interface PlasmaCanvasProps {
  /** True while the mic or the speaker is open; only then may audio drive it. */
  audioActive: boolean
  /** A fixed level for callers that do not bind the live store. */
  audioLevel?: number
  live: boolean
  platform: boolean
  reducedMotion: boolean
  signal: number
  /** The background the orb is painted on. */
  surface?: PlasmaSurface
  tone: PlasmaTone
}

/** Called once the canvas knows whether it can paint, so the SVG layers it
 *  replaces stay visible when it cannot (no 2D context, e.g. a headless run). */
export type PlasmaReadyHandler = (ready: boolean) => void

/**
 * Owns the canvas and its animation loop. Nothing here renders through React
 * after mount: the loop reads the live level straight from the store, so the
 * orb animates at display rate while the dashboard around it stays still.
 */
export function PlasmaCanvas({
  audioActive,
  audioLevel = 0,
  live,
  onReady,
  platform,
  reducedMotion,
  signal,
  surface = 'dark',
  tone
}: PlasmaCanvasProps & { onReady?: PlasmaReadyHandler }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest inputs for the loop, without restarting it on every state change.
  const inputs = useRef({ audioActive, audioLevel, live, platform, signal, surface, tone })
  inputs.current = { audioActive, audioLevel, live, platform, signal, surface, tone }
  // The hero is large enough to carry a denser cloud.
  const orbRef = useRef<ParticleOrb | null>(null)
  orbRef.current ??= new ParticleOrb(platform ? 520 : 340)
  const orb = orbRef.current

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d') ?? null

    onReady?.(Boolean(ctx))

    if (!canvas || !ctx) {
      return undefined
    }

    let frame = 0
    let width = 0
    let height = 0
    let smoothed = 0
    const started = performance.now()
    let last = started

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      // Capped: a 2x panel is plenty for soft light, and 3x quadruples fill cost.
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const paint = (now: number) => {
      const current = inputs.current

      const target = current.audioActive ? clampMicLevel(current.live ? $micLevel.get() : current.audioLevel) : 0

      // Ease toward the measured level: a raw RMS meter flickers, light shouldn't.
      smoothed += (target - smoothed) * 0.18

      if (!reducedMotion) {
        orb.step((now - last) / 1000, { level: smoothed, signal: current.signal, tone: current.tone })
      }

      last = now

      drawPlasmaFrame(ctx, width, height, {
        level: smoothed,
        orb,
        platform: current.platform,
        surface: current.surface,
        signal: current.signal,
        time: reducedMotion ? 0 : (now - started) / 1000,
        tone: current.tone
      })
    }

    const loop = (now: number) => {
      paint(now)
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      cancelAnimationFrame(frame)

      if (reducedMotion) {
        paint(performance.now())

        return
      }

      frame = requestAnimationFrame(loop)
    }

    // A window in the background burns no GPU on an orb nobody sees.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
      } else {
        last = performance.now()
        start()
      }
    }

    resize()
    start()

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            resize()

            if (reducedMotion) {
              paint(performance.now())
            }
          })
        : null

    observer?.observe(canvas)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [onReady, orb, reducedMotion])

  // A still frame must still follow state changes under reduced motion.
  useEffect(() => {
    if (!reducedMotion) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d') ?? null

    if (!canvas || !ctx) {
      return
    }

    const rect = canvas.getBoundingClientRect()

    drawPlasmaFrame(ctx, Math.max(1, rect.width), Math.max(1, rect.height), {
      level: 0,
      orb,
      platform,
      signal,
      surface,
      time: 0,
      tone
    })
  }, [orb, platform, reducedMotion, signal, surface, tone])

  return <canvas aria-hidden="true" className="jarvis-core__plasma" data-testid="jarvis-core-plasma" ref={canvasRef} />
}
