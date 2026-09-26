import { describe, expect, it } from 'vitest'

import {
  beginOnboardingTransaction,
  compensateOnboardingTransaction,
  endOnboardingTransaction,
  OnboardingTransactionBusyError,
  runOnboardingTransaction,
  StaleOnboardingTransactionError
} from './onboarding-transaction'

const A = { connectionId: 'local', profile: 'a' }

describe('onboarding transaction ownership', () => {
  it('locks synchronously and allows different owners to proceed', async () => {
    const first = beginOnboardingTransaction(A)
    expect(() => beginOnboardingTransaction(A)).toThrow(OnboardingTransactionBusyError)

    const other = beginOnboardingTransaction({ connectionId: 'local', profile: 'b' })
    other.assertCurrent()
    endOnboardingTransaction(other)
    endOnboardingTransaction(first)

    await expect(runOnboardingTransaction(A, async context => context.owner.profile)).resolves.toBe('a')
  })

  it('does not compensate after the owner transaction has ended', async () => {
    const context = beginOnboardingTransaction(A)
    endOnboardingTransaction(context)
    const compensate = async () => undefined

    await expect(compensateOnboardingTransaction(context, compensate)).resolves.toBe(false)
  })

  it('rejects stale work and always releases the lock', async () => {
    await expect(
      runOnboardingTransaction(A, async context => {
        context.assertCurrent()
        endOnboardingTransaction(context)
        expect(() => context.assertCurrent()).toThrow(StaleOnboardingTransactionError)
        throw new Error('cancelled')
      })
    ).rejects.toThrow('cancelled')

    await expect(runOnboardingTransaction(A, async () => 'recovered')).resolves.toBe('recovered')
  })
})
