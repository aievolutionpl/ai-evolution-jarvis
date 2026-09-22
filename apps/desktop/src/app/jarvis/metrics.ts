/**
 * Real metrics derived from the Jarvis activity stream.
 *
 * Every number here comes from backend events the renderer already received —
 * their `type`, their `toolCallId` pairing, and their timestamps. Nothing is
 * estimated, smoothed, or invented: when the stream is empty the metrics say
 * so (`events === 0`) and the surface renders an empty state instead of a
 * decorative chart. See `docs/product/AI_EVOLUTION_JARVIS_DESIGN.md` §5.
 */

import type { JarvisEvent } from './types'

/**
 * One tool, tallied across the events of the current session.
 *
 * Rows are keyed by the label the user sees, not by call id: three runs of
 * "Terminal" read as one tool used three times, which is the question the
 * panel answers.
 */
export interface JarvisToolUsage {
  /** Stable key for React lists and chart marks. */
  id: string
  label: string
  /** `tool.completed` events seen for this tool. */
  runs: number
  /** Started and not yet completed. */
  running: number
  /** Summed duration of matched start→complete pairs. */
  totalMs: number
}

/** One equal-width slice of the session's event timeline. */
export interface JarvisTimelineBucket {
  index: number
  startedAt: number
  endedAt: number
  count: number
}

export interface JarvisMetrics {
  events: number
  toolRuns: number
  toolsRunning: number
  verified: number
  failed: number
  cancelled: number
  approvals: number
  firstAt: null | number
  lastAt: null | number
  spanMs: number
  /** Median of matched tool durations — null until a tool actually finished. */
  medianToolMs: null | number
  /** Busiest tools first, then alphabetically so equal counts stay stable. */
  tools: readonly JarvisToolUsage[]
  timeline: readonly JarvisTimelineBucket[]
}

export const DEFAULT_TIMELINE_BUCKETS = 12

const EMPTY_METRICS: JarvisMetrics = {
  approvals: 0,
  cancelled: 0,
  events: 0,
  failed: 0,
  firstAt: null,
  lastAt: null,
  medianToolMs: null,
  spanMs: 0,
  timeline: [],
  toolRuns: 0,
  toolsRunning: 0,
  tools: [],
  verified: 0
}

/** The user-facing identity of a tool: its label, or the call id when unlabeled. */
function toolKey(event: JarvisEvent): string {
  return event.label?.trim() || event.toolCallId || event.type
}

function median(values: readonly number[]): null | number {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function buildTimeline(events: readonly JarvisEvent[], bucketCount: number): JarvisTimelineBucket[] {
  const buckets = Math.max(1, Math.trunc(bucketCount))
  const timestamps = events.map(event => event.at)
  const firstAt = Math.min(...timestamps)
  const lastAt = Math.max(...timestamps)
  const span = lastAt - firstAt
  // A burst inside one millisecond (and the single-event case) has no span to
  // slice — one bucket is the honest rendering, not `buckets` empty columns.
  const width = span > 0 ? span / buckets : 0

  if (width === 0) {
    return [{ count: events.length, endedAt: lastAt, index: 0, startedAt: firstAt }]
  }

  const counts = new Array<number>(buckets).fill(0)

  for (const event of events) {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor((event.at - firstAt) / width)))
    counts[index] += 1
  }

  return counts.map((count, index) => ({
    count,
    endedAt: firstAt + width * (index + 1),
    index,
    startedAt: firstAt + width * index
  }))
}

/**
 * Fold the activity stream into the numbers the dashboard renders.
 *
 * Pure and order-tolerant for counting, but tool pairing follows stream order:
 * a `tool.completed` matches the most recent unmatched `tool.started` with the
 * same call id, which is exactly how the gateway emits them.
 */
export function deriveJarvisMetrics(events: readonly JarvisEvent[], options: { buckets?: number } = {}): JarvisMetrics {
  if (events.length === 0) {
    return EMPTY_METRICS
  }

  const usage = new Map<string, JarvisToolUsage>()
  // Keyed by call id so interleaved tools pair correctly; falls back to the
  // usage key when the gateway did not send one.
  const openCalls = new Map<string, { at: number; usageKey: string }>()
  const durations: number[] = []

  let approvals = 0
  let cancelled = 0
  let failed = 0
  let toolRuns = 0
  let verified = 0

  const entryFor = (key: string): JarvisToolUsage => {
    const existing = usage.get(key)

    if (existing) {
      return existing
    }

    const created: JarvisToolUsage = { id: key, label: key, runs: 0, running: 0, totalMs: 0 }
    usage.set(key, created)

    return created
  }

  for (const event of events) {
    switch (event.type) {
      case 'task.approval':
        approvals += 1
        break
      case 'task.cancelled':
        cancelled += 1
        break
      case 'task.failed':
        failed += 1
        break
      case 'task.verified':
        verified += 1
        break
      case 'tool.started': {
        const usageKey = toolKey(event)
        entryFor(usageKey).running += 1
        openCalls.set(event.toolCallId ?? usageKey, { at: event.at, usageKey })
        break
      }
      case 'tool.completed': {
        const callKey = event.toolCallId ?? toolKey(event)
        const open = openCalls.get(callKey)
        // Prefer the start event's identity: a completion is sometimes
        // unlabeled, and re-keying it would split one tool into two rows.
        const entry = entryFor(open?.usageKey ?? toolKey(event))

        toolRuns += 1
        entry.runs += 1

        if (open) {
          openCalls.delete(callKey)
          entry.running = Math.max(0, entry.running - 1)
          const duration = Math.max(0, event.at - open.at)
          entry.totalMs += duration
          durations.push(duration)
        }

        break
      }
      default:
        break
    }
  }

  const tools = [...usage.values()].sort(
    (a, b) => b.runs + b.running - (a.runs + a.running) || a.label.localeCompare(b.label)
  )

  const timestamps = events.map(event => event.at)
  const firstAt = Math.min(...timestamps)
  const lastAt = Math.max(...timestamps)

  return {
    approvals,
    cancelled,
    events: events.length,
    failed,
    firstAt,
    lastAt,
    medianToolMs: median(durations),
    spanMs: Math.max(0, lastAt - firstAt),
    timeline: buildTimeline(events, options.buckets ?? DEFAULT_TIMELINE_BUCKETS),
    toolRuns,
    toolsRunning: tools.reduce((total, tool) => total + tool.running, 0),
    tools,
    verified
  }
}

/** True when there is enough real data to draw anything at all. */
export function hasJarvisMetrics(metrics: JarvisMetrics): boolean {
  return metrics.events > 0
}
