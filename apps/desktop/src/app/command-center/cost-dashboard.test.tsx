import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getCosts } from '@/api/costs'

import { CostDashboard } from './cost-dashboard'

vi.mock('@/api/costs', async importOriginal => ({
  ...(await importOriginal()),
  getCosts: vi.fn(),
  refreshCosts: vi.fn()
}))

const response = {
  schema_version: 1,
  profile: 'default',
  period: { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' },
  attribution: 'desktop',
  provider_filter: null,
  totals: {
    request_count: 1,
    confirmed_usd: '0',
    estimated_usd: '0.1',
    unknown_requests: 1,
    unattributed_requests: 0,
    tokens: { input_tokens: 1, output_tokens: 2, cache_read_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0 }
  },
  by_work: [],
  by_session: [
    {
      session_id: 'stored-session',
      request_count: 1,
      confirmed_usd: '0',
      estimated_usd: '0.1',
      unknown_requests: 1,
      unattributed_requests: 0,
      tokens: { input_tokens: 1, output_tokens: 2, cache_read_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0 }
    }
  ],
  by_model: [],
  rows: [],
  next_cursor: null,
  legacy: {
    source: 'legacy_session_aggregates',
    estimated_usd: null,
    session_count: 0,
    included_in_request_totals: false,
    per_work_available: false
  },
  openrouter_key: {
    source: 'openrouter_key',
    scope: 'key_wide',
    currency: 'USD',
    credential_ref: null,
    status: 'fresh',
    fetched_at: null,
    last_attempt_at: null,
    usage_usd: '9',
    usage_daily_usd: null,
    usage_weekly_usd: null,
    usage_monthly_usd: null,
    byok_usage_usd: null,
    limit_usd: null,
    limit_remaining_usd: null,
    limit_reset: null,
    error_code: null
  },
  refresh: {
    status: 'complete',
    checked: 1,
    pending: 0,
    failed: 0,
    last_attempt_at: null,
    last_success_at: null,
    error_code: null
  }
} as never

describe('cost dashboard', () => {
  it('shows incomplete attribution and keeps key-wide spend separate', async () => {
    vi.mocked(getCosts).mockResolvedValue(response)
    render(
      <CostDashboard
        onOpenSession={vi.fn()}
        onScopeChange={vi.fn()}
        scope={{ connectionId: 'local', profile: 'default' }}
      />
    )
    await waitFor(() => expect(screen.getByTestId('cost-totals')).toBeTruthy())
    expect(screen.getByText('Unknown records')).toBeTruthy()
    expect(screen.getByText(/not this app's spend/)).toBeTruthy()
  })
})
