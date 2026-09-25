import { describe, expect, it } from 'vitest'

import { classifyInterrupt, isCurrentRevision } from './interrupt-intent'

describe('classifyInterrupt', () => {
  it.each([
    ['Stop.', 'stop_speech'],
    ['cicho', 'stop_speech'],
    ['Anuluj', 'cancel_task'],
    ['cancel the task', 'cancel_task'],
    ['Nie Chrome, Edge.', 'correct'],
    ['nie, jednak Figma', 'correct'],
    ['no, actually open Safari', 'correct'],
    ['Poczekaj', 'stop_turn'],
    ['Otwórz Chrome', null],
    ['Stop the music in Spotify', null]
  ] as const)('%s -> %s', (utterance, intent) => {
    expect(classifyInterrupt(utterance)).toBe(intent)
  })
})

describe('isCurrentRevision', () => {
  it('drops results from a superseded revision', () => {
    expect(isCurrentRevision({ revision: 2 }, 1)).toBe(false)
    expect(isCurrentRevision({ revision: 2 }, 2)).toBe(true)
    expect(isCurrentRevision(undefined, 1)).toBe(false)
  })
})
