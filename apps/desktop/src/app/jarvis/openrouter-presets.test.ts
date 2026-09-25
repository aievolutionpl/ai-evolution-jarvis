import { describe, expect, it } from 'vitest'

import type { ModelOptionProvider } from '@/types/hermes'

import {
  JARVIS_WORK_MODES,
  openRouterWorkModel,
  resolveOpenRouterPresets,
  workModeForEffort
} from './openrouter-presets'

function openRouter(models: string[], extra: Partial<ModelOptionProvider> = {}): ModelOptionProvider[] {
  return [{ authenticated: true, models, name: 'OpenRouter', slug: 'openrouter', ...extra }]
}

describe('resolveOpenRouterPresets', () => {
  it('only offers models the served catalog actually lists', () => {
    const models = ['openai/gpt-5.5', 'anthropic/claude-sonnet-5', 'google/gemini-3.7-flash', 'z-ai/glm-5.2:free']
    const { connected, presets } = resolveOpenRouterPresets(openRouter(models))

    expect(connected).toBe(true)

    for (const preset of presets) {
      expect(models).toContain(preset.model)
    }

    // No Hermes id in this catalog, so no Hermes preset — never a teaser.
    expect(presets.some(preset => preset.id === 'hermes')).toBe(false)
  })

  it('never resolves a paid preset to a routing variant or a free-tier id', () => {
    const models = [
      'openai/gpt-6-astra-fast',
      'openai/gpt-6-astra-flex',
      'openai/gpt-6-astra',
      'minimax/minimax-m3:free'
    ]

    const { presets } = resolveOpenRouterPresets(openRouter(models))
    const gpt = presets.find(preset => preset.id === 'gpt')
    const free = presets.find(preset => preset.id === 'free')

    expect(gpt?.model).toBe('openai/gpt-6-astra')
    expect(free?.model.endsWith(':free')).toBe(true)
  })

  it('treats a missing, unauthenticated or empty OpenRouter row as not connected', () => {
    expect(resolveOpenRouterPresets(undefined)).toEqual({ connected: false, presets: [] })
    expect(resolveOpenRouterPresets(openRouter(['openai/gpt-5.5'], { authenticated: false })).connected).toBe(false)
    expect(resolveOpenRouterPresets(openRouter([])).connected).toBe(false)
  })
})

describe('openRouterWorkModel', () => {
  it('starts work on the DeepSeek flash line, never a dated snapshot of it', () => {
    const models = ['openai/gpt-5.5', 'deepseek/deepseek-v4-flash-0731', 'deepseek/deepseek-v4.1-flash']
    const state = resolveOpenRouterPresets(openRouter(models))

    expect(openRouterWorkModel(state)).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('falls back to another served preset when the catalog has no DeepSeek', () => {
    const state = resolveOpenRouterPresets(openRouter(['openai/gpt-5.5']))

    expect(openRouterWorkModel(state)).toBe('openai/gpt-5.5')
    expect(openRouterWorkModel({ connected: false, presets: [] })).toBeUndefined()
  })
})

describe('workModeForEffort', () => {
  it('maps every work mode back to itself through its own effort', () => {
    for (const mode of JARVIS_WORK_MODES) {
      expect(workModeForEffort(mode.effort)).toBe(mode.id)
    }
  })

  it('folds unknown or empty levels into the balanced default', () => {
    expect(workModeForEffort('')).toBe('balanced')
    expect(workModeForEffort('something-new')).toBe('balanced')
  })
})
