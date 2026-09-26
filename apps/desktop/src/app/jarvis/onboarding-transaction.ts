import type { JarvisOnboardingScope } from './onboarding-state'

export interface OnboardingOwner {
  connectionId: string
  profile: string
}

export interface OnboardingTransactionContext {
  owner: OnboardingOwner
  isCurrent: () => boolean
  assertCurrent: () => void
}

export class OnboardingTransactionBusyError extends Error {
  constructor(owner: OnboardingOwner) {
    super(`Onboarding is already being updated for ${owner.connectionId}::${owner.profile}`)
    this.name = 'OnboardingTransactionBusyError'
  }
}

export class StaleOnboardingTransactionError extends Error {
  constructor() {
    super('Onboarding transaction owner changed')
    this.name = 'StaleOnboardingTransactionError'
  }
}

const activeOwners = new Set<string>()
const generations = new Map<string, number>()

export function normalizeOnboardingOwner(scope: JarvisOnboardingScope): OnboardingOwner {
  return {
    connectionId: String(scope.connectionId || 'local').trim() || 'local',
    profile: String(scope.profile || 'default').trim() || 'default'
  }
}

function ownerKey(owner: OnboardingOwner): string {
  return `${owner.connectionId}::${owner.profile}`
}

/**
 * Acquires the owner lock before the first await. This is deliberately a
 * synchronous check/set so a double click cannot create two mutation chains.
 */
export function beginOnboardingTransaction(scope: JarvisOnboardingScope): OnboardingTransactionContext {
  const owner = normalizeOnboardingOwner(scope)
  const key = ownerKey(owner)

  if (activeOwners.has(key)) {
    throw new OnboardingTransactionBusyError(owner)
  }

  activeOwners.add(key)
  const generation = (generations.get(key) ?? 0) + 1
  generations.set(key, generation)

  const isCurrent = () => activeOwners.has(key) && generations.get(key) === generation

  return {
    owner,
    isCurrent,
    assertCurrent: () => {
      if (!isCurrent()) {
        throw new StaleOnboardingTransactionError()
      }
    }
  }
}

export function endOnboardingTransaction(context: OnboardingTransactionContext): void {
  activeOwners.delete(ownerKey(context.owner))
}

export async function runOnboardingTransaction<T>(
  scope: JarvisOnboardingScope,
  work: (context: OnboardingTransactionContext) => Promise<T>
): Promise<T> {
  const context = beginOnboardingTransaction(scope)

  try {
    return await work(context)
  } finally {
    endOnboardingTransaction(context)
  }
}

/** Compensation is owner-guarded: an old transaction cannot undo newer work. */
export async function compensateOnboardingTransaction(
  context: OnboardingTransactionContext,
  compensate: () => Promise<void>
): Promise<boolean> {
  if (!context.isCurrent()) {
    return false
  }

  await compensate()

  return context.isCurrent()
}
