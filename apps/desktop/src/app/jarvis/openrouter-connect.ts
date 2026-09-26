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

import type { ProfileScope } from '@/api/client'
import { getGlobalModelOptions, setEnvVar, setGlobalModel, validateProviderCredential } from '@/hermes'
import type { ModelOptionsResponse } from '@/types/hermes'

import { OPENROUTER_PROVIDER_SLUG, openRouterWorkModel, resolveOpenRouterPresets } from './openrouter-presets'

export const OPENROUTER_ENV_KEY = 'OPENROUTER_API_KEY'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'

export interface OpenRouterConnectDeps {
  validate: (key: string, scope?: ProfileScope) => Promise<{ message?: string; ok: boolean; reachable: boolean }>
  saveKey: (key: string, scope?: ProfileScope) => Promise<unknown>
  loadOptions: (scope?: ProfileScope) => Promise<ModelOptionsResponse>
  /** Make the chosen model the default; omitted when the caller commits it later (onboarding). */
  setDefaultModel?: (provider: string, model: string, scope?: ProfileScope) => Promise<unknown>
}

export type OpenRouterConnectResult =
  | { ok: true; model?: string; options: ModelOptionsResponse }
  | { ok: false; reason: 'empty' | 'rejected'; message?: string }

export const defaultOpenRouterConnectDeps: OpenRouterConnectDeps = {
  loadOptions: scope => getGlobalModelOptions({ refresh: true }, scope),
  saveKey: (key, scope) => setEnvVar(OPENROUTER_ENV_KEY, key, scope),
  setDefaultModel: (provider, model, scope) => setGlobalModel(provider, model, scope),
  validate: (key, scope) => validateProviderCredential(OPENROUTER_ENV_KEY, key, undefined, scope)
}

export async function connectOpenRouter(
  rawKey: string,
  deps: OpenRouterConnectDeps,
  scope?: ProfileScope
): Promise<OpenRouterConnectResult> {
  const key = rawKey.trim()

  if (!key) {
    return { ok: false, reason: 'empty' }
  }

  try {
    const probe = await deps.validate(key, ...(scope === undefined ? [] : [scope]))

    if (probe.reachable && !probe.ok) {
      return { message: probe.message, ok: false, reason: 'rejected' }
    }
  } catch {
    // An unreachable probe is not a verdict on the key.
  }

  await deps.saveKey(key, ...(scope === undefined ? [] : [scope]))

  const options = await deps.loadOptions(...(scope === undefined ? [] : [scope]))
  const model = openRouterWorkModel(resolveOpenRouterPresets(options.providers))

  if (model && deps.setDefaultModel) {
    await deps.setDefaultModel(OPENROUTER_PROVIDER_SLUG, model, ...(scope === undefined ? [] : [scope]))
  }

  return { model, ok: true, options }
}
