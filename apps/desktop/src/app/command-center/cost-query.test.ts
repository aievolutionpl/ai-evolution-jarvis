import { describe, expect, it } from 'vitest'

import { costQueryKey, createCostQuery, periodForDays, queryWithFilters } from './cost-query'

describe('cost query contracts', () => {
  it('keeps the explicit owner and every drill-down filter in the cache key', () => {
    const base = createCostQuery(30, new Date('2026-09-26T00:00:00Z'))
    const filtered = { ...base, provider: 'openrouter', session_id: 'session-a', work_turn_id: 'turn-a' }
    const first = costQueryKey({ connectionId: 'local', profile: 'default' }, queryWithFilters(base))
    const second = costQueryKey({ connectionId: 'remote', profile: 'default' }, queryWithFilters(filtered))

    expect(first).not.toEqual(second)
    expect(second).toContain('openrouter')
    expect(second).toContain('session-a')
    expect(second).toContain('turn-a')
  })

  it('uses an exclusive UTC end and the requested day span', () => {
    const period = periodForDays(7, new Date('2026-09-26T12:00:00Z'))
    expect(period.to).toBe('2026-09-26T12:00:00.000Z')
    expect(new Date(period.to).getTime() - new Date(period.from).getTime()).toBe(7 * 86_400_000)
  })
})
