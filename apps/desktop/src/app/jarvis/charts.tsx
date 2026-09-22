/**
 * The dashboard's two micro-charts.
 *
 * Both are single-series and plot counts the gateway actually emitted, so they
 * carry one accent hue and no legend — nothing here encodes a value twice.
 * Neither renders at all without data: a chart with no numbers behind it is
 * decoration, which this product does not ship.
 *
 * Marks follow the house chart spec: thin columns with rounded data-ends
 * anchored to the baseline, a 2px surface gap between neighbours, a hairline
 * recessive axis, and direct labels only on the extreme. Colors come from
 * `--ui-*` tokens so light, dark, and custom themes stay in step.
 */

import { fmtClock } from '@/lib/time'
import { cn } from '@/lib/utils'

import type { JarvisMetrics, JarvisTimelineBucket, JarvisToolUsage } from './metrics'

const PLOT_WIDTH = 240
const PLOT_HEIGHT = 56
const COLUMN_GAP = 2
const CORNER_RADIUS = 3

export interface JarvisChartCopy {
  timelineTitle: string
  timelineSummary: (events: number) => string
  timelineBucket: (count: number, from: string, to: string) => string
  timelineEmpty: string
  toolsTitle: string
  toolsEmpty: string
  toolRuns: (runs: number) => string
  toolRunning: (running: number) => string
  columnHeader: { bucket: string; count: string; tool: string }
}

/** A column with rounded top corners and a square foot on the baseline. */
function columnPath(x: number, width: number, height: number): string {
  const radius = Math.min(CORNER_RADIUS, width / 2, height)
  const top = PLOT_HEIGHT - height
  const right = x + width

  return [
    `M ${x} ${PLOT_HEIGHT}`,
    `L ${x} ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    `L ${right - radius} ${top}`,
    `Q ${right} ${top} ${right} ${top + radius}`,
    `L ${right} ${PLOT_HEIGHT}`,
    'Z'
  ].join(' ')
}

export function JarvisTimelineChart({
  className,
  copy,
  timeline,
  total
}: {
  className?: string
  copy: JarvisChartCopy
  timeline: readonly JarvisTimelineBucket[]
  total: number
}) {
  if (timeline.length === 0 || total === 0) {
    return <p className="text-sm text-(--ui-text-secondary)">{copy.timelineEmpty}</p>
  }

  const peak = Math.max(...timeline.map(bucket => bucket.count))
  const slot = PLOT_WIDTH / timeline.length
  const width = Math.max(2, slot - COLUMN_GAP)
  const peakIndex = timeline.findIndex(bucket => bucket.count === peak)
  const from = fmtClock.format(timeline[0].startedAt)
  const to = fmtClock.format(timeline.at(-1)?.endedAt ?? timeline[0].endedAt)

  return (
    <figure className={cn('m-0 flex flex-col gap-1', className)}>
      <svg
        aria-label={copy.timelineSummary(total)}
        className="w-full"
        focusable="false"
        height={PLOT_HEIGHT}
        role="img"
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
      >
        {timeline.map(bucket => {
          // Peak-relative height: the axis label and the table carry the
          // absolute counts, so the columns only have to be comparable.
          const height = bucket.count === 0 ? 0 : Math.max(2, (bucket.count / peak) * (PLOT_HEIGHT - 2))

          if (height === 0) {
            return null
          }

          return (
            <path
              d={columnPath(bucket.index * slot, width, height)}
              fill="var(--ui-accent)"
              key={bucket.index}
              opacity={bucket.index === peakIndex ? 1 : 0.62}
            >
              <title>
                {copy.timelineBucket(bucket.count, fmtClock.format(bucket.startedAt), fmtClock.format(bucket.endedAt))}
              </title>
            </path>
          )
        })}
        <line
          stroke="var(--ui-stroke-tertiary)"
          strokeWidth={1}
          x1={0}
          x2={PLOT_WIDTH}
          y1={PLOT_HEIGHT}
          y2={PLOT_HEIGHT}
        />
      </svg>
      <figcaption className="flex items-baseline justify-between text-xs tabular-nums text-(--ui-text-tertiary)">
        <span>{from}</span>
        <span className="text-(--ui-text-secondary)">{copy.timelineSummary(total)}</span>
        <span>{to}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{copy.timelineTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.columnHeader.bucket}</th>
            <th scope="col">{copy.columnHeader.count}</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map(bucket => (
            <tr key={bucket.index}>
              <th scope="row">
                {fmtClock.format(bucket.startedAt)}–{fmtClock.format(bucket.endedAt)}
              </th>
              <td>{bucket.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function JarvisToolChart({
  className,
  copy,
  limit = 5,
  tools
}: {
  className?: string
  copy: JarvisChartCopy
  limit?: number
  tools: readonly JarvisToolUsage[]
}) {
  const rows = tools.slice(0, limit)

  if (rows.length === 0) {
    return <p className="text-sm text-(--ui-text-secondary)">{copy.toolsEmpty}</p>
  }

  const peak = Math.max(...rows.map(tool => tool.runs + tool.running))

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(tool => {
        const value = tool.runs + tool.running
        const percent = peak === 0 ? 0 : Math.max(4, Math.round((value / peak) * 100))

        return (
          <li className={cn('flex flex-col gap-1', className)} key={tool.id}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-(--ui-text-primary)">{tool.label}</span>
              <span className="shrink-0 tabular-nums text-(--ui-text-secondary)">
                {tool.running > 0 ? copy.toolRunning(tool.running) : copy.toolRuns(tool.runs)}
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 w-full rounded-full bg-(--ui-bg-quaternary)">
              <div
                className="h-full rounded-full bg-(--ui-accent)"
                style={{ opacity: tool.running > 0 ? 1 : 0.72, width: `${percent}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** True when there is enough measured activity for either chart to say anything. */
export function hasChartableActivity(metrics: JarvisMetrics): boolean {
  return metrics.events > 0
}
