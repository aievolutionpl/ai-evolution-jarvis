import { useEffect, useRef } from 'react'

import { $micLevel, clampMicLevel } from '@/store/voice-level'

import { ParticleOrb } from './particle-orb'
import { drawPlasmaFrame, type PlasmaSurface, type PlasmaTone } from './plasma'
import { sizePlasmaCanvas } from './plasma-canvas-size'
import { listenToStillAudio, paintPlasmaStill } from './plasma-still'

export interface PlasmaCanvasProps {
  /** True while the mic or the speaker is open; only then may audio drive it. */
  audioActive: boolean
  /** A fixed level for callers that do not bind the live store. */
  audioLevel?: number
  live: boolean
  /** The home hero: large enough to carry a denser cloud. */
  hero?: boolean
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
  hero = false,
  live,
  onReady,
  reducedMotion,
  signal,
  surface = 'dark',
  tone
}: PlasmaCanvasProps & { onReady?: PlasmaReadyHandler }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest inputs for the loop, without restarting it on every state change.
  const inputs = useRef({ audioActive, audioLevel, live, signal, surface, tone })
  inputs.current = { audioActive, audioLevel, live, signal, surface, tone }
  const orbRef = useRef<ParticleOrb | null>(null)
  orbRef.current ??= new ParticleOrb(hero ? 520 : 340)
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
      ;({ width, height } = sizePlasmaCanvas(canvas, ctx))
    }

    const paint = (now: number) => {
      const current = inputs.current

      const target = current.audioActive ? clampMicLevel(current.live ? $micLevel.get() : current.audioLevel) : 0

      smoothed = reducedMotion ? target : smoothed + (target - smoothed) * 0.18

      if (reducedMotion) {
        orb.settle({ level: smoothed, signal: current.signal, tone: current.tone })
      } else {
        orb.step((now - last) / 1000, { level: smoothed, signal: current.signal, tone: current.tone })
      }

      last = now

      drawPlasmaFrame(ctx, width, height, {
        level: smoothed,
        orb,
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

  useEffect(() => {
    if (!reducedMotion) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d') ?? null

    if (!canvas || !ctx) {
      return
    }

    const redraw = () => {
      const rect = canvas.getBoundingClientRect()
      const level = audioActive ? clampMicLevel(live ? $micLevel.get() : audioLevel) : 0
      paintPlasmaStill(ctx, Math.max(1, rect.width), Math.max(1, rect.height), orb, { level, signal, surface, tone })
    }

    redraw()

    if (live && audioActive) {
      return listenToStillAudio(redraw)
    }

    return undefined
  }, [audioActive, audioLevel, live, orb, reducedMotion, signal, surface, tone])

  return <canvas aria-hidden="true" className="jarvis-core__plasma" data-testid="jarvis-core-plasma" ref={canvasRef} />
}
