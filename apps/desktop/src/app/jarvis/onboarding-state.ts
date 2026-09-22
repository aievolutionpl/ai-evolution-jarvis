import { atom } from 'nanostores'

import { getApiRequestConnection, getApiRequestProfile } from '@/hermes'

import { isJarvisComputerMode, type JarvisComputerMode } from './computer-capabilities'

export const JARVIS_ONBOARDING_VERSION = 2
export const JARVIS_ONBOARDING_STATE_KEY = 'ai-evolution-jarvis-onboarding-v1'

export const JARVIS_ONBOARDING_STEPS = [
  'profile',
  'engine',
  'model',
  'voice',
  'access',
  'computer',
  'approvals'
] as const

/** v1 shipped without the computer step; its payloads are migrated, not dropped. */
const JARVIS_ONBOARDING_V1_STEPS = ['profile', 'engine', 'model', 'voice', 'access', 'approvals'] as const

export type JarvisOnboardingStep = (typeof JARVIS_ONBOARDING_STEPS)[number]

export type JarvisApprovalProductMode = 'balanced' | 'strict'
export type JarvisVoiceMode = 'quiet' | 'spoken'

export interface JarvisOnboardingScope {
  connectionId?: null | string
  profile?: null | string
}

export interface JarvisOnboardingSelections {
  accessOpened?: boolean
  approvalsMode?: JarvisApprovalProductMode
  computerMode?: JarvisComputerMode
  engine?: string
  model?: string
  profile?: string
  validatedAccessModel?: string
  validatedAccessProvider?: string
  validatedModel?: string
  validatedProvider?: string
  voiceMode?: JarvisVoiceMode
}

export interface JarvisOnboardingState {
  version: number
  completedSteps: JarvisOnboardingStep[]
  currentStep: JarvisOnboardingStep
  selections?: JarvisOnboardingSelections
}

const STEP_SET = new Set<string>(JARVIS_ONBOARDING_STEPS)

export function initialJarvisOnboardingState(step: JarvisOnboardingStep = 'profile'): JarvisOnboardingState {
  return {
    version: JARVIS_ONBOARDING_VERSION,
    completedSteps: [],
    currentStep: step,
    selections: {}
  }
}

function isStep(value: unknown): value is JarvisOnboardingStep {
  return typeof value === 'string' && STEP_SET.has(value)
}

interface NormalizedJarvisOnboardingScope {
  connectionId: string
  profile: string
}

function normalizeScope(scope?: JarvisOnboardingScope): NormalizedJarvisOnboardingScope {
  return {
    connectionId: String(scope?.connectionId || 'local').trim() || 'local',
    profile: String(scope?.profile || 'default').trim() || 'default'
  }
}

export function normalizeJarvisOnboardingScope(scope?: JarvisOnboardingScope): NormalizedJarvisOnboardingScope {
  return normalizeScope(scope)
}

export function jarvisOnboardingScopeKey(scope?: JarvisOnboardingScope): string {
  const normalized = normalizeScope(scope)

  return `${encodeURIComponent(normalized.connectionId)}::${encodeURIComponent(normalized.profile)}`
}

export function currentJarvisOnboardingScope(): NormalizedJarvisOnboardingScope {
  return normalizeScope({
    connectionId: getApiRequestConnection(),
    profile: getApiRequestProfile()
  })
}

export function jarvisOnboardingStorageKey(scope: JarvisOnboardingScope = currentJarvisOnboardingScope()): string {
  const normalized = normalizeScope(scope)
  const suffix = `${encodeURIComponent(normalized.connectionId)}::${encodeURIComponent(normalized.profile)}`

  return `${JARVIS_ONBOARDING_STATE_KEY}:${suffix}`
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isApprovalMode(value: unknown): value is JarvisApprovalProductMode {
  return value === 'balanced' || value === 'strict'
}

function isVoiceMode(value: unknown): value is JarvisVoiceMode {
  return value === 'quiet' || value === 'spoken'
}

function sanitizeSelections(value: unknown): JarvisOnboardingSelections {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const raw = value as Record<string, unknown>
  const selections: JarvisOnboardingSelections = {}
  const accessOpened = safeBoolean(raw.accessOpened)
  const engine = safeString(raw.engine)
  const model = safeString(raw.model)
  const profile = safeString(raw.profile)
  const validatedAccessModel = safeString(raw.validatedAccessModel)
  const validatedAccessProvider = safeString(raw.validatedAccessProvider)
  const validatedModel = safeString(raw.validatedModel)
  const validatedProvider = safeString(raw.validatedProvider)

  if (accessOpened !== undefined) {
    selections.accessOpened = accessOpened
  }

  if (isApprovalMode(raw.approvalsMode)) {
    selections.approvalsMode = raw.approvalsMode
  }

  if (isJarvisComputerMode(raw.computerMode)) {
    selections.computerMode = raw.computerMode
  }

  if (engine) {
    selections.engine = engine
  }

  if (model) {
    selections.model = model
  }

  if (profile) {
    selections.profile = profile
  }

  if (validatedAccessModel) {
    selections.validatedAccessModel = validatedAccessModel
  }

  if (validatedAccessProvider) {
    selections.validatedAccessProvider = validatedAccessProvider
  }

  if (validatedModel) {
    selections.validatedModel = validatedModel
  }

  if (validatedProvider) {
    selections.validatedProvider = validatedProvider
  }

  if (isVoiceMode(raw.voiceMode)) {
    selections.voiceMode = raw.voiceMode
  }

  return selections
}

export function sanitizeJarvisOnboardingState(state: JarvisOnboardingState): JarvisOnboardingState {
  const currentStep = isStep(state.currentStep) ? state.currentStep : 'profile'

  const completedSteps = Array.from(
    new Set((Array.isArray(state.completedSteps) ? state.completedSteps : []).filter(isStep))
  )

  return {
    version: JARVIS_ONBOARDING_VERSION,
    completedSteps,
    currentStep,
    selections: sanitizeSelections(state.selections)
  }
}

function isSupportedVersion(version: unknown): version is number {
  return version === 1 || version === JARVIS_ONBOARDING_VERSION
}

/**
 * Carry a v1 payload forward.
 *
 * Someone who already finished setup must not be dragged back through the
 * wizard because we added a step, so a complete v1 run counts the computer
 * step as done. It is marked complete without a `computerMode`: no toolset was
 * chosen, so none is claimed — the tips window is what introduces the new
 * capability. A half-finished v1 run keeps its progress and meets the new step
 * on the way through.
 */
function migrateV1CompletedSteps(completedSteps: unknown[]): JarvisOnboardingStep[] {
  const steps = completedSteps.filter(isStep)
  const wasComplete = JARVIS_ONBOARDING_V1_STEPS.every(step => steps.includes(step))

  return wasComplete ? [...steps, 'computer'] : steps
}

export function serializeJarvisOnboardingState(state: JarvisOnboardingState): string {
  return JSON.stringify(sanitizeJarvisOnboardingState(state))
}

export function parseJarvisOnboardingState(raw: string | null): JarvisOnboardingState | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<JarvisOnboardingState>

    if (!isSupportedVersion(parsed.version) || !isStep(parsed.currentStep)) {
      return null
    }

    const completedSteps: unknown[] = Array.isArray(parsed.completedSteps) ? parsed.completedSteps : []

    return sanitizeJarvisOnboardingState({
      version: JARVIS_ONBOARDING_VERSION,
      currentStep: parsed.currentStep,
      completedSteps: parsed.version === 1 ? migrateV1CompletedSteps(completedSteps) : completedSteps.filter(isStep),
      selections: parsed.selections && typeof parsed.selections === 'object' ? parsed.selections : {}
    })
  } catch {
    return null
  }
}

export function readJarvisOnboardingState(
  storage: Storage | undefined = globalThis.localStorage,
  scope: JarvisOnboardingScope = currentJarvisOnboardingScope()
): JarvisOnboardingState | null {
  if (!storage) {
    return null
  }

  try {
    return parseJarvisOnboardingState(storage.getItem(jarvisOnboardingStorageKey(scope)))
  } catch {
    return null
  }
}

export function writeJarvisOnboardingState(
  state: JarvisOnboardingState,
  storage?: Storage,
  scope: JarvisOnboardingScope = currentJarvisOnboardingScope()
): boolean {
  const targetStorage = arguments.length >= 2 ? storage : globalThis.localStorage

  if (!targetStorage) {
    return false
  }

  try {
    targetStorage.setItem(jarvisOnboardingStorageKey(scope), serializeJarvisOnboardingState(state))

    return true
  } catch {
    return false
  }
}

/**
 * Bumped the moment setup commits.
 *
 * The wizard writes completion to storage, and storage does not notify — so
 * surfaces that ask "is setup done?" (the tips window) would keep answering
 * from the read they did when they mounted, i.e. mid-wizard. This is the one
 * seam between them, and it carries no data: subscribers re-read the scoped
 * state they already know how to read.
 */
export const $jarvisOnboardingCompletedAt = atom(0)

export function markJarvisOnboardingCompleted(): void {
  $jarvisOnboardingCompletedAt.set(Date.now())
}

export function jarvisOnboardingComplete(state: JarvisOnboardingState | null): boolean {
  return Boolean(
    state &&
      state.version === JARVIS_ONBOARDING_VERSION &&
      JARVIS_ONBOARDING_STEPS.every(step => state.completedSteps.includes(step))
  )
}

export function shouldShowJarvisOnboarding(state: JarvisOnboardingState | null): boolean {
  return !jarvisOnboardingComplete(state)
}

export function approvalConfigMode(mode: JarvisApprovalProductMode): 'manual' | 'smart' {
  return mode === 'strict' ? 'manual' : 'smart'
}
