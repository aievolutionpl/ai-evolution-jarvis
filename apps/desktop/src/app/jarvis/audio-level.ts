/**
 * Turns the measured microphone level (`@/store/voice-level`) into the CSS
 * custom properties the Jarvis visuals animate on.
 *
 * The binding writes straight to the element's style, so a live pulse costs
 * zero React renders — the meter ticks every animation frame, and neither the
 * core nor the chat around it may re-render at that rate.
 */

import { type RefObject, useEffect } from 'react'

import { $micLevel, clampMicLevel } from '@/store/voice-level'

export { clampMicLevel as clampAudioLevel }

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function formatPx(value: number): string {
  return `${formatNumber(value)}px`
}

/**
 * The audio-reactive half of the core's variables.
 *
 * Pure, so the same numbers back the first React paint and every imperative
 * frame after it — the pulse can never drift from what the markup declared.
 */
export function jarvisAudioVars(level: number, taskSignal: number): Record<string, string> {
  const safeLevel = clampMicLevel(level)
  const energyScale = 1 + safeLevel * 0.36
  const liquidShift = (0.5 - safeLevel) * 6

  return {
    '--jarvis-audio-level': formatNumber(safeLevel),
    '--jarvis-audio-scale-max': formatNumber(1 + safeLevel * 0.46),
    '--jarvis-audio-scale-min': formatNumber(1 + safeLevel * 0.18),
    '--jarvis-breathe-scale-max': formatNumber(energyScale * 1.08),
    '--jarvis-breathe-scale-min': formatNumber(energyScale * 0.96),
    '--jarvis-counter-scale-max': formatNumber(energyScale * 1.02),
    '--jarvis-counter-scale-min': formatNumber(energyScale * 0.88),
    '--jarvis-current-opacity': formatNumber(0.32 + taskSignal * 0.52),
    '--jarvis-energy-scale': formatNumber(energyScale),
    '--jarvis-halo-opacity': formatNumber(0.34 + safeLevel * 0.38 + taskSignal * 0.16),
    '--jarvis-liquid-opacity': formatNumber(0.58 + safeLevel * 0.26),
    '--jarvis-liquid-shift': formatPx(liquidShift),
    '--jarvis-liquid-shift-crest': formatPx(liquidShift - 4),
    // Ripples and the level ring: a measured level pushes them outward and
    // brightens them. At silence they collapse to the resting radius.
    '--jarvis-pulse-opacity': formatNumber(safeLevel * 0.72),
    '--jarvis-pulse-scale': formatNumber(1 + safeLevel * 0.3),
    '--jarvis-task-signal': formatNumber(taskSignal)
  }
}

/**
 * Bind the live level to an element's CSS variables.
 *
 * `enabled` decides who owns those variables: unbound, the caller's own
 * inline style is authoritative and this hook touches nothing. `active` then
 * gates the subscription, so an element that is neither listening nor
 * speaking rests at zero and does no per-frame work at all.
 */
export function useJarvisAudioBinding(
  ref: RefObject<HTMLElement | null>,
  { active, enabled, taskSignal = 0 }: { active: boolean; enabled: boolean; taskSignal?: number }
): void {
  useEffect(() => {
    const element = ref.current

    if (!element || !enabled) {
      return undefined
    }

    const write = (level: number) => {
      for (const [name, value] of Object.entries(jarvisAudioVars(level, taskSignal))) {
        element.style.setProperty(name, value)
      }
    }

    if (!active) {
      write(0)

      return undefined
    }

    // nanostores fires the listener immediately, so the first paint after the
    // mic opens already carries the current level.
    return $micLevel.subscribe(write)
  }, [active, enabled, ref, taskSignal])
}

/**
 * Bind the live level to a single `--jarvis-audio-level` variable, for meters
 * that size themselves from it without the full core variable set.
 */
export function useMicLevelVar(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const element = ref.current

    if (!element) {
      return undefined
    }

    const write = (level: number) => {
      element.style.setProperty('--jarvis-audio-level', formatNumber(clampMicLevel(level)))
      element.setAttribute('aria-valuenow', String(Math.round(clampMicLevel(level) * 100)))
    }

    if (!active) {
      write(0)

      return undefined
    }

    return $micLevel.subscribe(write)
  }, [active, ref])
}
