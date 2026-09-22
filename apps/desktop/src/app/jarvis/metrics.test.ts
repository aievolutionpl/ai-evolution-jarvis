import { describe, expect, it } from 'vitest'

import { deriveJarvisMetrics, hasJarvisMetrics } from './metrics'
import type { JarvisEvent } from './types'

function event(overrides: Partial<JarvisEvent> & Pick<JarvisEvent, 'at' | 'type'>): JarvisEvent {
  return { sessionId: 's1', taskId: 't1', ...overrides }
}

describe('deriveJarvisMetrics', () => {
  it('reports no data for an empty stream instead of inventing a baseline', () => {
    const metrics = deriveJarvisMetrics([])

    expect(hasJarvisMetrics(metrics)).toBe(false)
    expect(metrics).toMatchObject({
      events: 0,
      firstAt: null,
      medianToolMs: null,
      spanMs: 0,
      toolRuns: 0
    })
    expect(metrics.timeline).toEqual([])
    expect(metrics.tools).toEqual([])
  })

  it('pairs tool starts with completions and measures the real duration', () => {
    const metrics = deriveJarvisMetrics([
      event({ at: 1_000, label: 'Terminal', toolCallId: 'a', type: 'tool.started' }),
      event({ at: 3_000, label: 'Terminal', toolCallId: 'a', type: 'tool.completed' }),
      event({ at: 4_000, label: 'Pliki', toolCallId: 'b', type: 'tool.started' })
    ])

    expect(metrics.toolRuns).toBe(1)
    expect(metrics.toolsRunning).toBe(1)
    expect(metrics.medianToolMs).toBe(2_000)
    expect(metrics.tools).toEqual([
      { id: 'Pliki', label: 'Pliki', runs: 0, running: 1, totalMs: 0 },
      { id: 'Terminal', label: 'Terminal', runs: 1, running: 0, totalMs: 2_000 }
    ])
  })

  it('pairs interleaved tool calls by call id, not by arrival order', () => {
    const metrics = deriveJarvisMetrics([
      event({ at: 0, label: 'Terminal', toolCallId: 'a', type: 'tool.started' }),
      event({ at: 100, label: 'Pliki', toolCallId: 'b', type: 'tool.started' }),
      event({ at: 300, toolCallId: 'b', type: 'tool.completed' }),
      event({ at: 900, toolCallId: 'a', type: 'tool.completed' })
    ])

    expect(metrics.tools).toEqual([
      { id: 'Pliki', label: 'Pliki', runs: 1, running: 0, totalMs: 200 },
      { id: 'Terminal', label: 'Terminal', runs: 1, running: 0, totalMs: 900 }
    ])
    expect(metrics.toolsRunning).toBe(0)
  })

  it('counts a completion without a matching start without inventing a duration', () => {
    const metrics = deriveJarvisMetrics([
      event({ at: 5_000, label: 'Terminal', toolCallId: 'orphan', type: 'tool.completed' })
    ])

    expect(metrics.toolRuns).toBe(1)
    expect(metrics.medianToolMs).toBeNull()
    expect(metrics.tools[0]).toMatchObject({ label: 'Terminal', runs: 1, running: 0, totalMs: 0 })
  })

  it('tallies task outcomes from their own event types', () => {
    const metrics = deriveJarvisMetrics([
      event({ at: 1, type: 'task.planning' }),
      event({ at: 2, type: 'task.approval' }),
      event({ at: 3, type: 'task.verified' }),
      event({ at: 4, taskId: 't2', type: 'task.failed' }),
      event({ at: 5, taskId: 't3', type: 'task.cancelled' })
    ])

    expect(metrics).toMatchObject({ approvals: 1, cancelled: 1, events: 5, failed: 1, verified: 1 })
  })

  it('buckets events across the real span and keeps empty buckets empty', () => {
    const metrics = deriveJarvisMetrics(
      [
        event({ at: 0, type: 'tool.started', toolCallId: 'a' }),
        event({ at: 0, type: 'tool.completed', toolCallId: 'a' }),
        event({ at: 1_000, type: 'task.verified' })
      ],
      { buckets: 4 }
    )

    expect(metrics.timeline.map(bucket => bucket.count)).toEqual([2, 0, 0, 1])
    expect(metrics.timeline[0].startedAt).toBe(0)
    expect(metrics.timeline.at(-1)?.endedAt).toBe(1_000)
    expect(metrics.spanMs).toBe(1_000)
  })

  it('collapses a zero-span burst into a single honest bucket', () => {
    const metrics = deriveJarvisMetrics(
      [event({ at: 7, type: 'task.running' }), event({ at: 7, type: 'task.verified' })],
      { buckets: 8 }
    )

    expect(metrics.timeline).toEqual([{ count: 2, endedAt: 7, index: 0, startedAt: 7 }])
  })

  it('groups repeated runs of one tool into a single busiest-first row', () => {
    const metrics = deriveJarvisMetrics([
      event({ at: 1, label: 'Terminal', toolCallId: 'a', type: 'tool.started' }),
      event({ at: 2, label: 'Terminal', toolCallId: 'a', type: 'tool.completed' }),
      event({ at: 3, label: 'Pliki', toolCallId: 'b', type: 'tool.started' }),
      event({ at: 4, label: 'Pliki', toolCallId: 'b', type: 'tool.completed' }),
      event({ at: 5, label: 'Pliki', toolCallId: 'c', type: 'tool.started' }),
      event({ at: 6, label: 'Pliki', toolCallId: 'c', type: 'tool.completed' })
    ])

    expect(metrics.tools).toEqual([
      { id: 'Pliki', label: 'Pliki', runs: 2, running: 0, totalMs: 2 },
      { id: 'Terminal', label: 'Terminal', runs: 1, running: 0, totalMs: 1 }
    ])
  })
})
