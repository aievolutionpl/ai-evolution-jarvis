/**
 * What "Jarvis pracuje na komputerze" actually turns on.
 *
 * The product asks one question — how much of this machine may Jarvis touch —
 * and answers it with the toolsets the backend already ships. Nothing here
 * invents a capability: every entry is a real Hermes toolset name, so the
 * Tools surface and `hermes tools` keep showing the same truth as this step.
 *
 * The plan is a strict partition (`enable` + `disable` cover every managed
 * toolset), because a user who steps DOWN from operator to chat must lose the
 * desktop control they gave, not keep it because nobody turned it off.
 */

import type { ComputerUseStatus } from '@/types/hermes'

export const JARVIS_COMPUTER_MODES = ['chat', 'assist', 'operator'] as const

export type JarvisComputerMode = (typeof JARVIS_COMPUTER_MODES)[number]

export const JARVIS_DEFAULT_COMPUTER_MODE: JarvisComputerMode = 'operator'

/** Toolsets this step owns. Anything outside the list is left exactly as the
 *  user (or another surface) configured it. */
export const JARVIS_MANAGED_TOOLSETS = ['web', 'file', 'terminal', 'browser', 'computer_use'] as const

const MODE_TOOLSETS: Record<JarvisComputerMode, readonly string[]> = {
  chat: ['web'],
  assist: ['web', 'file', 'terminal', 'browser'],
  operator: ['web', 'file', 'terminal', 'browser', 'computer_use']
}

export interface JarvisToolsetPlan {
  disable: string[]
  enable: string[]
}

export function isJarvisComputerMode(value: unknown): value is JarvisComputerMode {
  return typeof value === 'string' && (JARVIS_COMPUTER_MODES as readonly string[]).includes(value)
}

/** The toolsets a mode turns on, and the managed ones it turns off. */
export function jarvisToolsetPlan(mode: JarvisComputerMode): JarvisToolsetPlan {
  const wanted = new Set(MODE_TOOLSETS[mode])

  return {
    disable: JARVIS_MANAGED_TOOLSETS.filter(name => !wanted.has(name)),
    enable: JARVIS_MANAGED_TOOLSETS.filter(name => wanted.has(name))
  }
}

/** Only the operator mode drives the screen, so only it needs cua-driver. */
export function computerModeNeedsDesktopControl(mode: JarvisComputerMode): boolean {
  return MODE_TOOLSETS[mode].includes('computer_use')
}

export type JarvisComputerReadiness = 'needs-permissions' | 'not-installed' | 'ready' | 'unknown' | 'unsupported'

/**
 * Fold the backend's cross-platform probe into the one word the step shows.
 *
 * `ready` is the backend's own unified signal (TCC grants on macOS, driver
 * health elsewhere), so this never re-derives readiness from the parts.
 */
export function describeComputerReadiness(status: ComputerUseStatus | null): JarvisComputerReadiness {
  if (!status) {
    return 'unknown'
  }

  if (!status.platform_supported) {
    return 'unsupported'
  }

  if (!status.installed) {
    return 'not-installed'
  }

  if (status.ready === true) {
    return 'ready'
  }

  return status.ready === false ? 'needs-permissions' : 'unknown'
}

export interface ApplyToolsetPlanResult {
  /** Toolsets the backend refused, in plan order. Empty means everything applied. */
  failed: string[]
}

/**
 * Apply a plan toolset by toolset.
 *
 * Deliberately not atomic and deliberately not fatal: this runs AFTER the
 * model/config transaction has committed, so a backend that rejects one
 * toolset must not roll back a finished setup. The caller reports what failed
 * and points at the Tools surface, which owns these switches anyway.
 */
export async function applyJarvisToolsetPlan(
  plan: JarvisToolsetPlan,
  setEnabled: (name: string, enabled: boolean) => Promise<unknown>
): Promise<ApplyToolsetPlanResult> {
  const failed: string[] = []

  for (const name of plan.enable) {
    try {
      await setEnabled(name, true)
    } catch {
      failed.push(name)
    }
  }

  for (const name of plan.disable) {
    try {
      await setEnabled(name, false)
    } catch {
      failed.push(name)
    }
  }

  return { failed }
}
