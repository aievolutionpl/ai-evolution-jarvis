import { describe, expect, it } from 'vitest'

import type { AnalyticsDailyEntry } from '@/types/hermes'

import { sessionTrend, sparklinePath } from './insights-card'

const day = (key: string, sessions: number) => ({ day: key, sessions }) as AnalyticsDailyEntry

describe('sessionTrend', () => {
  const today = new Date(2026, 8, 25, 12)

  it('fills missing days with zero and keeps one point per day, oldest first', () => {
    const trend = sessionTrend([day('2026-09-25', 4), day('2026-09-20', 2)], today, 14)

    expect(trend.series).toHaveLength(14)
    expect(trend.series.at(-1)).toBe(4)
    expect(trend.series.at(-6)).toBe(2)
    expect(trend.total).toBe(6)
  })

  it('compares this week with the week before, and says nothing without a week before', () => {
    const doubled = sessionTrend([day('2026-09-15', 2), day('2026-09-24', 4)], today, 14)

    expect(doubled.changePct).toBe(100)
    expect(sessionTrend([day('2026-09-24', 4)], today, 14).changePct).toBeNull()
  })
})

describe('sparklinePath', () => {
  it('spans the whole width and stays inside the box', () => {
    const path = sparklinePath([0, 3, 1, 5], 240, 56)
    const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const xs = numbers.filter((_, index) => index % 2 === 0)
    const ys = numbers.filter((_, index) => index % 2 === 1)

    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(240)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(56)
  })
})
