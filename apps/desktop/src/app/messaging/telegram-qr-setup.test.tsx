import { describe, expect, it } from 'vitest'

import { formatExpiry, isTerminalTelegramOnboardingError } from './telegram-qr-setup'

describe('Telegram QR setup state helpers', () => {
  it('treats an expired or claimed pairing response as terminal', () => {
    expect(isTerminalTelegramOnboardingError(new Error('HTTP 410 pairing expired'))).toBe(true)
    expect(isTerminalTelegramOnboardingError(new Error('HTTP 410 temporary network error'))).toBe(false)
  })

  it('does not show a negative countdown for an expired pairing', () => {
    const now = Date.parse('2026-09-26T12:00:59.000Z')

    expect(formatExpiry('2026-09-26T11:59:59.000Z', now)).toBeNull()
    expect(formatExpiry('2026-09-26T12:01:01.000Z', now)).toBe('0:02')
  })
})
