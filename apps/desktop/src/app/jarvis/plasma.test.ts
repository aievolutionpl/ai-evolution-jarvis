import { describe, expect, it } from 'vitest'

import { plasmaPalette, plasmaTone } from './plasma'
import type { JarvisTaskPhase, JarvisVoiceState } from './types'

const VOICES: JarvisVoiceState[] = ['idle', 'listening', 'speaking', 'error']
const TASKS: JarvisTaskPhase[] = [
  'idle',
  'planning',
  'running',
  'approval',
  'cancelling',
  'cancelled',
  'failed',
  'verified'
]

describe('plasmaTone', () => {
  it('gives every voice × task pair a palette', () => {
    for (const voice of VOICES) {
      for (const task of TASKS) {
        expect(plasmaPalette(plasmaTone(voice, task))).toBeDefined()
      }
    }
  })

  it('lets an open mic or speaker outrank the task, except for errors', () => {
    for (const task of TASKS) {
      const listening = plasmaTone('listening', task)

      expect(listening).toBe(task === 'failed' ? 'error' : 'listening')
    }

    expect(plasmaTone('error', 'verified')).toBe('error')
  })

  it('stays at rest when nothing is happening', () => {
    expect(plasmaTone('idle', 'idle')).toBe('idle')
    expect(plasmaTone('idle', 'cancelled')).toBe('idle')
  })
})
