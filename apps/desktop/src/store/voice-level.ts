/**
 * The live microphone level of the main composer's voice conversation.
 *
 * Owned by the voice feature (which owns the recorder) and read by whoever
 * visualizes it — today the Jarvis core and its mic meter. It is its own tiny
 * store on purpose: the meter ticks once per animation frame, so routing it
 * through React state in the chat shell would re-render the transcript sixty
 * times a second. Subscribers bind it to CSS variables instead.
 *
 * The value is always measured. Zero means silence, a closed mic, or no
 * microphone at all — never "we have nothing, animate anyway".
 */

import { atom } from 'nanostores'

export const $micLevel = atom(0)

/** Quantization step: finer than the eye resolves, coarse enough to drop the
 *  redundant sets a raw RMS meter emits every frame. */
export const MIC_LEVEL_STEP = 1 / 64

export function clampMicLevel(value: null | number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

export function publishMicLevel(level: null | number | undefined): void {
  const next = Math.round(clampMicLevel(level) / MIC_LEVEL_STEP) * MIC_LEVEL_STEP

  if (Math.abs(next - $micLevel.get()) >= MIC_LEVEL_STEP / 2) {
    $micLevel.set(next)
  }
}

export function resetMicLevel(): void {
  $micLevel.set(0)
}
