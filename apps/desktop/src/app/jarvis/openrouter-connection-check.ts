import type { ProfileScope } from '@/api/client'
import type { ModelOptionsResponse } from '@/types/hermes'

export type OpenRouterConnectionFailure =
  'invalid_credentials' | 'insufficient_credit' | 'timeout' | 'unavailable_model' | 'unreachable'

export type OpenRouterConnectionCheck =
  | { ok: true; model: string; options: ModelOptionsResponse }
  | { ok: false; reason: OpenRouterConnectionFailure; message?: string }

export interface OpenRouterConnectionCheckDeps {
  validate: (scope?: ProfileScope) => Promise<{ message?: string; ok: boolean; reachable: boolean; status?: number }>
  loadOptions: (scope?: ProfileScope) => Promise<ModelOptionsResponse>
  chooseModel?: (options: ModelOptionsResponse) => string | undefined
}

function timedOut(error: unknown): boolean {
  return error instanceof Error && /timeout|timed out|time out/i.test(error.message)
}

export async function checkOpenRouterConnection(
  deps: OpenRouterConnectionCheckDeps,
  scope?: ProfileScope
): Promise<OpenRouterConnectionCheck> {
  try {
    const validation = await deps.validate(scope)

    if (!validation.reachable) {
      return { message: validation.message, ok: false, reason: 'unreachable' }
    }

    if (!validation.ok) {
      return {
        message: validation.message,
        ok: false,
        reason: validation.status === 402 ? 'insufficient_credit' : 'invalid_credentials'
      }
    }

    const options = await deps.loadOptions(scope)

    const model =
      deps.chooseModel?.(options) ??
      options.providers?.find(provider => (provider.models?.length ?? 0) > 0)?.models?.[0]

    if (!model) {
      return { ok: false, reason: 'unavailable_model' }
    }

    return { model, ok: true, options }
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : undefined,
      ok: false,
      reason: timedOut(error) ? 'timeout' : 'unreachable'
    }
  }
}
