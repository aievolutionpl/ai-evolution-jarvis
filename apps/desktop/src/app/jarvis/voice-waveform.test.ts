import { describe, expect, it } from 'vitest'

import { pushWaveformSample } from './voice-waveform'

describe('pushWaveformSample', () => {
  it('keeps the newest samples last and never grows past its window', () => {
    let history: number[] = []

    for (let index = 1; index <= 10; index += 1) {
      history = pushWaveformSample(history, index / 10, 4)
    }

    expect(history).toEqual([0.7, 0.8, 0.9, 1])
  })

  it('clamps readings to the meter range instead of drawing off-canvas', () => {
    expect(pushWaveformSample([], 5, 4)).toEqual([1])
    expect(pushWaveformSample([], Number.NaN, 4)).toEqual([0])
  })
})
