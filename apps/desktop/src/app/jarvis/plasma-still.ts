import { $micLevel, clampMicLevel } from '@/store/voice-level'

import type { ParticleOrb } from './particle-orb'
import { drawPlasmaFrame, type PlasmaSurface, type PlasmaTone } from './plasma'

/** One static state snapshot; the caller decides when another snapshot is needed. */
export function paintPlasmaStill(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  orb: ParticleOrb,
  input: { level: number; signal: number; surface: PlasmaSurface; tone: PlasmaTone }
): void {
  orb.settle(input)
  drawPlasmaFrame(ctx, width, height, { ...input, orb, time: 0 })
}

/** Update only when the still brightness changes visibly; never start a frame loop. */
export function listenToStillAudio(redraw: () => void): () => void {
  let bucket = Math.round(clampMicLevel($micLevel.get()) * 4)

  return $micLevel.listen(value => {
    const next = Math.round(clampMicLevel(value) * 4)

    if (next !== bucket) {
      bucket = next
      redraw()
    }
  })
}
