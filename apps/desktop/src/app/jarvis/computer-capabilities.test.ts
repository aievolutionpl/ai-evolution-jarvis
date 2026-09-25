import { describe, expect, it, vi } from 'vitest'

import type { ComputerUseStatus } from '@/types/hermes'

import {
  applyJarvisToolsetPlan,
  describeComputerReadiness,
  JARVIS_COMPUTER_MODES,
  JARVIS_MANAGED_TOOLSETS,
  jarvisToolsetPlan
} from './computer-capabilities'

function status(overrides: Partial<ComputerUseStatus> = {}): ComputerUseStatus {
  return {
    accessibility: null,
    can_grant: false,
    checks: [],
    error: null,
    installed: true,
    platform: 'linux',
    platform_supported: true,
    ready: true,
    screen_recording: null,
    screen_recording_capturable: null,
    source: null,
    version: 'cua-driver 0.5.1',
    ...overrides
  }
}

describe('jarvisToolsetPlan', () => {
  it('partitions every managed toolset so stepping down actually revokes', () => {
    for (const mode of JARVIS_COMPUTER_MODES) {
      const plan = jarvisToolsetPlan(mode)

      expect([...plan.enable, ...plan.disable].sort()).toEqual([...JARVIS_MANAGED_TOOLSETS].sort())
      expect(plan.enable.filter(name => plan.disable.includes(name))).toEqual([])
    }
  })

  it('only hands over the desktop in operator mode', () => {
    expect(jarvisToolsetPlan('chat').disable).toContain('computer_use')
    expect(jarvisToolsetPlan('assist').disable).toContain('computer_use')
    expect(jarvisToolsetPlan('operator').enable).toContain('computer_use')
    expect(jarvisToolsetPlan('assist').enable).toEqual(['web', 'file', 'terminal', 'browser'])
  })
})

describe('describeComputerReadiness', () => {
  it('reads the backend’s own verdict rather than re-deriving it', () => {
    expect(describeComputerReadiness(null)).toBe('unknown')
    expect(describeComputerReadiness(status({ platform_supported: false }))).toBe('unsupported')
    expect(describeComputerReadiness(status({ installed: false }))).toBe('not-installed')
    expect(describeComputerReadiness(status({ ready: false }))).toBe('needs-permissions')
    expect(describeComputerReadiness(status({ ready: null }))).toBe('unknown')
    expect(describeComputerReadiness(status())).toBe('ready')
  })
})

describe('applyAgent CzesiekToolsetPlan', () => {
  it('applies the whole plan and reports refusals instead of aborting', async () => {
    const setEnabled = vi.fn(async (name: string) => {
      if (name === 'terminal') {
        throw new Error('backend said no')
      }
    })

    const result = await applyJarvisToolsetPlan(jarvisToolsetPlan('assist'), setEnabled)

    expect(result.failed).toEqual(['terminal'])
    expect(setEnabled).toHaveBeenCalledTimes(JARVIS_MANAGED_TOOLSETS.length)
    expect(setEnabled).toHaveBeenCalledWith('computer_use', false)
  })
})
