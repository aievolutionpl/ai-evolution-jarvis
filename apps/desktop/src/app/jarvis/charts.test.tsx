import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { type JarvisChartCopy, JarvisTimelineChart, JarvisToolChart } from './charts'
import { deriveJarvisMetrics } from './metrics'
import type { JarvisEvent } from './types'

const copy: JarvisChartCopy = {
  columnHeader: { bucket: 'Przedział', count: 'Zdarzenia', tool: 'Narzędzie' },
  timelineBucket: (count, from, to) => `${from}–${to}: ${count}`,
  timelineEmpty: 'Brak zdarzeń do pokazania na wykresie.',
  timelineSummary: events => `${events} zdarzeń`,
  timelineTitle: 'Aktywność w czasie',
  toolRunning: running => `${running} w toku`,
  toolRuns: runs => `${runs}×`,
  toolsEmpty: 'Brak narzędzi.',
  toolsTitle: 'Użyte narzędzia'
}

function event(at: number, type: string, overrides: Partial<JarvisEvent> = {}): JarvisEvent {
  return { at, sessionId: 's1', type, ...overrides }
}

afterEach(() => {
  cleanup()
})

describe('JarvisTimelineChart', () => {
  it('refuses to draw anything without measured events', () => {
    render(<JarvisTimelineChart copy={copy} timeline={[]} total={0} />)

    expect(screen.getByText('Brak zdarzeń do pokazania na wykresie.')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('draws one column per non-empty bucket and none for the empty ones', () => {
    const metrics = deriveJarvisMetrics(
      [event(0, 'task.running'), event(0, 'tool.started'), event(1_000, 'task.verified')],
      { buckets: 4 }
    )

    const { container } = render(<JarvisTimelineChart copy={copy} timeline={metrics.timeline} total={metrics.events} />)

    // Two populated buckets out of four: an empty bucket draws no mark.
    expect(container.querySelectorAll('path')).toHaveLength(2)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('3 zdarzeń')
  })

  it("publishes every bucket's count as text, not only as a bar height", () => {
    const metrics = deriveJarvisMetrics([event(0, 'task.running'), event(1_000, 'task.verified')], { buckets: 2 })

    render(<JarvisTimelineChart copy={copy} timeline={metrics.timeline} total={metrics.events} />)

    const table = screen.getByRole('table', { name: 'Aktywność w czasie' })
    const cells = within(table).getAllByRole('cell')

    expect(cells.map(cell => cell.textContent)).toEqual(['1', '1'])
  })
})

describe('JarvisToolChart', () => {
  it('says nothing has run rather than drawing an empty bar', () => {
    render(<JarvisToolChart copy={copy} tools={[]} />)

    expect(screen.getByText('Brak narzędzi.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('labels each tool with its real count and flags the one still running', () => {
    const metrics = deriveJarvisMetrics([
      event(1, 'tool.started', { label: 'Terminal', toolCallId: 'a' }),
      event(2, 'tool.completed', { label: 'Terminal', toolCallId: 'a' }),
      event(3, 'tool.started', { label: 'Terminal', toolCallId: 'b' }),
      event(4, 'tool.completed', { label: 'Terminal', toolCallId: 'b' }),
      event(5, 'tool.started', { label: 'Pliki', toolCallId: 'c' })
    ])

    render(<JarvisToolChart copy={copy} tools={metrics.tools} />)

    const rows = screen.getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Terminal')
    expect(rows[0].textContent).toContain('2×')
    expect(rows[1].textContent).toContain('Pliki')
    expect(rows[1].textContent).toContain('1 w toku')
  })

  it('keeps the list to the requested number of tools', () => {
    const metrics = deriveJarvisMetrics(
      ['a', 'b', 'c', 'd'].flatMap((id, index) => [
        event(index * 2, 'tool.started', { label: `Tool ${id}`, toolCallId: id }),
        event(index * 2 + 1, 'tool.completed', { label: `Tool ${id}`, toolCallId: id })
      ])
    )

    render(<JarvisToolChart copy={copy} limit={2} tools={metrics.tools} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
