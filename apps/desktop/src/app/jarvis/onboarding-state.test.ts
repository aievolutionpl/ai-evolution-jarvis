import { describe, expect, it } from 'vitest'

import { JARVIS_ONBOARDING_STEPS, parseJarvisOnboardingState, shouldShowJarvisOnboarding } from './onboarding-state'

const V2_STEPS = ['profile', 'engine', 'model', 'voice', 'access', 'computer', 'approvals']

describe('onboarding migration', () => {
  it('does not drag anyone who finished an earlier setup back through the wizard', () => {
    for (const [version, steps] of [
      [1, ['profile', 'engine', 'model', 'voice', 'access', 'approvals']],
      [2, V2_STEPS]
    ] as const) {
      const state = parseJarvisOnboardingState(
        JSON.stringify({ completedSteps: steps, currentStep: 'approvals', version })
      )

      expect(shouldShowJarvisOnboarding(state)).toBe(false)
    }
  })

  it('keeps a half-finished run where it was and lets it meet the new steps on the way', () => {
    const state = parseJarvisOnboardingState(
      JSON.stringify({ completedSteps: ['profile', 'engine'], currentStep: 'model', version: 2 })
    )

    expect(state?.currentStep).toBe('model')
    expect(state?.completedSteps).toEqual(['profile', 'engine'])
    expect(shouldShowJarvisOnboarding(state)).toBe(true)
  })

  it('keeps only connections this build knows about', () => {
    const state = parseJarvisOnboardingState(
      JSON.stringify({
        completedSteps: [],
        currentStep: 'connections',
        selections: { connections: ['google', 'google', 'fax-machine', 'phone'] },
        version: 3
      })
    )

    expect(state?.selections?.connections).toEqual(['google', 'phone'])
  })

  it('starts a fresh setup by explaining how Agent Czesiek works', () => {
    expect(JARVIS_ONBOARDING_STEPS[0]).toBe('welcome')
    expect(JARVIS_ONBOARDING_STEPS.at(-1)).toBe('approvals')
  })
})
