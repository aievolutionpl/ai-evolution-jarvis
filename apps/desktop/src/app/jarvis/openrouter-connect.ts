/**
 * One-step OpenRouter connection: paste a key, land on a working model.
 *
 * The key is checked against OpenRouter first, but only a definite "rejected"
 * blocks — an unreachable probe (proxy, regional block, rate limit) still
 * saves, matching the main onboarding's rule that a flaky probe must not lock
 * a legitimate user out. After saving, the served catalog decides the model:
 * the work preset (DeepSeek flash) when OpenRouter lists it, else the first
 * preset it does list.
 */

import { getGlobalModelOptions, setEnvVar, setGlobalModel, validateProviderCredential } from '@/hermes'
import type { ModelOptionsResponse } from '@/types/hermes'

import { OPENROUTER_PROVIDER_SLUG, openRouterWorkModel, resolveOpenRouterPresets } from './openrouter-presets'

export const OPENROUTER_ENV_KEY = 'OPENROUTER_API_KEY'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'

export interface OpenRouterConnectDeps {
  validate: (key: string) => Promise<{ message?: string; ok: boolean; reachable: boolean }>
  saveKey: (key: string) => Promise<unknown>
  loadOptions: () => Promise<ModelOptionsResponse>
  /** Make the chosen model the default; omitted when the caller commits it later (onboarding). */
  setDefaultModel?: (provider: string, model: string) => Promise<unknown>
}

export type OpenRouterConnectResult =
  | { ok: true; model?: string; options: ModelOptionsResponse }
  | { ok: false; reason: 'empty' | 'rejected'; message?: string }

export const defaultOpenRouterConnectDeps: OpenRouterConnectDeps = {
  loadOptions: () => getGlobalModelOptions({ refresh: true }),
  saveKey: key => setEnvVar(OPENROUTER_ENV_KEY, key),
  setDefaultModel: (provider, model) => setGlobalModel(provider, model),
  validate: key => validateProviderCredential(OPENROUTER_ENV_KEY, key)
}

export async function connectOpenRouter(rawKey: string, deps: OpenRouterConnectDeps): Promise<OpenRouterConnectResult> {
  const key = rawKey.trim()

  if (!key) {
    return { ok: false, reason: 'empty' }
  }

  try {
    const probe = await deps.validate(key)

    if (probe.reachable && !probe.ok) {
      return { message: probe.message, ok: false, reason: 'rejected' }
    }
  } catch {
    // An unreachable probe is not a verdict on the key.
  }

  await deps.saveKey(key)

  const options = await deps.loadOptions()
  const model = openRouterWorkModel(resolveOpenRouterPresets(options.providers))

  if (model && deps.setDefaultModel) {
    await deps.setDefaultModel(OPENROUTER_PROVIDER_SLUG, model)
  }

  return { model, ok: true, options }
}
