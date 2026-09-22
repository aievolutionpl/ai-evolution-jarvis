import { afterEach, describe, expect, it } from 'vitest'

import { $micLevel, MIC_LEVEL_STEP, publishMicLevel, resetMicLevel } from '@/store/voice-level'

import { clampAudioLevel, jarvisAudioVars } from './audio-level'

afterEach(() => {
  resetMicLevel()
})

describe('clampAudioLevel', () => {
  it('treats a missing or broken reading as silence rather than a guess', () => {
    expect(clampAudioLevel(undefined)).toBe(0)
    expect(clampAudioLevel(null)).toBe(0)
    expect(clampAudioLevel(Number.NaN)).toBe(0)
    expect(clampAudioLevel(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampAudioLevel(-3)).toBe(0)
    expect(clampAudioLevel(4)).toBe(1)
    expect(clampAudioLevel(0.25)).toBe(0.25)
  })
})

describe('publishMicLevel', () => {
  it('drops the redundant per-frame sets a raw meter produces', () => {
    const seen: number[] = []
    const unsubscribe = $micLevel.subscribe(level => seen.push(level))

    publishMicLevel(0.5)
    publishMicLevel(0.5001)
    publishMicLevel(0.502)
    unsubscribe()

    // The initial listener call plus exactly one real change.
    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(0)
    expect(seen[1]).toBeCloseTo(0.5, 2)
  })

  it('tracks a genuine level change and returns to silence on reset', () => {
    publishMicLevel(0.8)
    expect($micLevel.get()).toBeCloseTo(0.8, 2)

    publishMicLevel(0.1)
    expect(Math.abs($micLevel.get() - 0.1)).toBeLessThanOrEqual(MIC_LEVEL_STEP)

    resetMicLevel()
    expect($micLevel.get()).toBe(0)
  })
})

describe('jarvisAudioVars', () => {
  it('keeps the pulse collapsed and transparent at silence', () => {
    const vars = jarvisAudioVars(0, 0)

    expect(vars['--jarvis-audio-level']).toBe('0')
    expect(vars['--jarvis-pulse-opacity']).toBe('0')
    expect(vars['--jarvis-pulse-scale']).toBe('1')
    expect(vars['--jarvis-energy-scale']).toBe('1')
  })

  it('grows the pulse with a measured level and with the task signal', () => {
    const quiet = jarvisAudioVars(0.2, 0)
    const loud = jarvisAudioVars(0.9, 0)

    expect(Number(loud['--jarvis-pulse-scale'])).toBeGreaterThan(Number(quiet['--jarvis-pulse-scale']))
    expect(Number(loud['--jarvis-pulse-opacity'])).toBeGreaterThan(Number(quiet['--jarvis-pulse-opacity']))
    expect(Number(loud['--jarvis-energy-scale'])).toBeGreaterThan(Number(quiet['--jarvis-energy-scale']))

    const idleTask = jarvisAudioVars(0, 0)
    const busyTask = jarvisAudioVars(0, 0.72)

    expect(Number(busyTask['--jarvis-current-opacity'])).toBeGreaterThan(Number(idleTask['--jarvis-current-opacity']))
    // A running task must not fake microphone input.
    expect(busyTask['--jarvis-pulse-opacity']).toBe('0')
  })

  it('clamps a bad reading instead of emitting an invalid transform', () => {
    const vars = jarvisAudioVars(Number.NaN, 0)

    expect(vars['--jarvis-audio-level']).toBe('0')
    expect(vars['--jarvis-liquid-shift']).toBe('3px')
  })
})
