import { describe, expect, it } from 'vitest'

import { orbMotionTargets, ParticleOrb, type ParticleOrbInput } from './particle-orb'
import type { PlasmaTone } from './plasma'

const TONES: PlasmaTone[] = ['idle', 'listening', 'working', 'speaking', 'approval', 'success', 'error']

function run(orb: ParticleOrb, input: ParticleOrbInput, seconds: number, fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame += 1) {
    orb.step(1 / fps, input)
  }
}

function meanRadius(orb: ParticleOrb): number {
  let total = 0

  for (let index = 0; index < orb.count; index += 1) {
    const i3 = index * 3
    total += Math.hypot(orb.positions[i3], orb.positions[i3 + 1], orb.positions[i3 + 2])
  }

  return total / orb.count
}

describe('ParticleOrb', () => {
  it('draws the cloud in while working and lets it rest wider when idle', () => {
    const idle = new ParticleOrb(200)
    const working = new ParticleOrb(200)

    run(idle, { level: 0, signal: 0, tone: 'idle' }, 8)
    run(working, { level: 0, signal: 0.7, tone: 'working' }, 8)

    expect(meanRadius(working)).toBeLessThan(meanRadius(idle))
    expect(orbMotionTargets('working').radius).toBeLessThan(orbMotionTargets('idle').radius)
  })

  it('sends electrons along links only while working', () => {
    const idle = new ParticleOrb(200)
    const working = new ParticleOrb(200)
    let sawElectron = false

    for (let frame = 0; frame < 6 * 60; frame += 1) {
      idle.step(1 / 60, { level: 0, signal: 0, tone: 'idle' })
      working.step(1 / 60, { level: 0, signal: 0.7, tone: 'working' })
      sawElectron ||= working.electronCount > 0
      expect(idle.electronCount).toBe(0)
    }

    expect(sawElectron).toBe(true)
  })

  it('breathes outward with the measured voice level', () => {
    const quiet = new ParticleOrb(200)
    const loud = new ParticleOrb(200)

    run(quiet, { level: 0, signal: 0, tone: 'speaking' }, 4)
    run(loud, { level: 0.9, signal: 0, tone: 'speaking' }, 4)

    expect(meanRadius(loud)).toBeGreaterThan(meanRadius(quiet))
  })

  it('settles the same way at 30 Hz and 144 Hz', () => {
    const slow = new ParticleOrb(200)
    const fast = new ParticleOrb(200)

    run(slow, { level: 0, signal: 0, tone: 'listening' }, 6, 30)
    run(fast, { level: 0, signal: 0, tone: 'listening' }, 6, 144)

    expect(Math.abs(slow.motion.radius - fast.motion.radius)).toBeLessThan(0.01)
  })

  it('stays bounded through every state and a long stall', () => {
    const orb = new ParticleOrb(200)

    for (const tone of TONES) {
      run(orb, { level: 1, signal: 1, tone }, 2)
      // A backgrounded tab resumes with a huge gap.
      orb.step(30, { level: 1, signal: 1, tone })
    }

    for (const value of orb.positions) {
      expect(Number.isFinite(value)).toBe(true)
      expect(Math.abs(value)).toBeLessThan(3)
    }
  })
})
