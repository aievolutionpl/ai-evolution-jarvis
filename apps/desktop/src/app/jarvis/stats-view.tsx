/**
 * The "Statystyki" insight view: measured counts from this session's event
 * stream, then the two micro-charts.
 *
 * Every tile is a count of events the backend sent. When a number cannot be
 * measured yet — no tool has finished, so there is no median duration — the
 * tile shows a dash rather than a zero, because "0 s" and "not yet known" are
 * different facts.
 */

import { cn } from '@/lib/utils'

import { JarvisTimelineChart, JarvisToolChart } from './charts'
import type { JarvisMetrics } from './metrics'
import type { JarvisStatsCopy } from './panel-copy'

function StatTile({
  label,
  tone = 'neutral',
  value
}: {
  label: string
  tone?: 'accent' | 'neutral' | 'warn'
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          'truncate text-lg font-semibold leading-6 tabular-nums',
          tone === 'accent' && 'text-(--ui-accent)',
          tone === 'warn' && 'text-destructive',
          tone === 'neutral' && 'text-(--ui-text-primary)'
        )}
      >
        {value}
      </span>
      <span className="text-xs leading-4 text-balance text-(--ui-text-secondary)">{label}</span>
    </div>
  )
}

export function JarvisStatsView({ copy, metrics }: { copy: JarvisStatsCopy; metrics: JarvisMetrics }) {
  if (metrics.events === 0) {
    return <p className="py-4 text-sm text-(--ui-text-secondary)">{copy.empty}</p>
  }

  const numbers = new Intl.NumberFormat()

  // Headings, not nested landmarks: three labelled <section>s inside the
  // rail's own complementary landmark would clutter a screen reader's
  // landmark list for what is really one panel with three groups.
  return (
    <div className="flex flex-col gap-5">
      <h3 className="sr-only">{copy.countsLabel}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <StatTile label={copy.toolRuns} value={numbers.format(metrics.toolRuns)} />
        <StatTile
          label={copy.medianToolTime}
          value={metrics.medianToolMs === null ? copy.notMeasured : copy.duration(metrics.medianToolMs)}
        />
        <StatTile
          label={copy.verified}
          tone={metrics.verified > 0 ? 'accent' : 'neutral'}
          value={numbers.format(metrics.verified)}
        />
        <StatTile
          label={copy.failed}
          tone={metrics.failed > 0 ? 'warn' : 'neutral'}
          value={numbers.format(metrics.failed)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">
          {copy.chart.timelineTitle}
        </h3>
        <JarvisTimelineChart copy={copy.chart} timeline={metrics.timeline} total={metrics.events} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">
          {copy.chart.toolsTitle}
        </h3>
        <JarvisToolChart copy={copy.chart} tools={metrics.tools} />
      </div>
    </div>
  )
}
