import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'

import { getCronJobs } from '@/api/cron'
import { getUsageAnalytics } from '@/api/models'
import { useI18n } from '@/i18n'
import { BarChart3 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile } from '@/store/profile'
import type { AnalyticsDailyEntry } from '@/types/hermes'

import { RailCard } from './rail-cards'

const INSIGHTS_DAYS = 14
const INSIGHTS_REFRESH_MS = 5 * 60_000

export interface SessionTrend {
  /** Sessions per day, oldest first, one entry per day of the window (gaps are 0). */
  series: number[]
  total: number
  /** This week against the week before, in percent; null when there is no earlier week to compare. */
  changePct: null | number
}

/**
 * Real sessions per day for the last `days` days, ending `today` (local
 * `YYYY-MM-DD` days, as the analytics endpoint reports them).
 */
export function sessionTrend(daily: readonly AnalyticsDailyEntry[], today: Date, days = INSIGHTS_DAYS): SessionTrend {
  const byDay = new Map(daily.map(entry => [entry.day, entry.sessions]))
  const series: number[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

    series.push(byDay.get(key) ?? 0)
  }

  const half = Math.floor(days / 2)
  const previous = series.slice(0, days - half).reduce((sum, n) => sum + n, 0)
  const current = series.slice(days - half).reduce((sum, n) => sum + n, 0)

  return {
    changePct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
    series,
    total: series.reduce((sum, n) => sum + n, 0)
  }
}

/** A smooth line through the series, scaled into a `width` × `height` box. */
export function sparklinePath(series: readonly number[], width: number, height: number): string {
  if (series.length < 2) {
    return ''
  }

  const max = Math.max(1, ...series)
  const step = width / (series.length - 1)
  const points = series.map((value, index) => [index * step, height - (value / max) * (height - 4) - 2] as const)

  return points.reduce((path, [x, y], index) => {
    if (index === 0) {
      return `M${x.toFixed(1)} ${y.toFixed(1)}`
    }

    const [px, py] = points[index - 1]
    const mid = (px + x) / 2

    return `${path} C${mid.toFixed(1)} ${py.toFixed(1)} ${mid.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
  }, '')
}

/** "Spostrzeżenia": the workspace's real rhythm — sessions over two weeks and the jobs that are on. */
export function JarvisInsightsCard({ connected }: { connected: boolean }) {
  const { t } = useI18n()
  const copy = t.jarvisShell.home.insights
  const profile = useStore($activeGatewayProfile)
  const gradientId = useId()

  const analytics = useQuery({
    enabled: connected,
    queryFn: () => getUsageAnalytics(INSIGHTS_DAYS),
    queryKey: ['jarvis-insights-analytics', profile, INSIGHTS_DAYS],
    refetchInterval: INSIGHTS_REFRESH_MS,
    staleTime: INSIGHTS_REFRESH_MS
  })

  const jobs = useQuery({
    enabled: connected,
    queryFn: () => getCronJobs(),
    queryKey: ['jarvis-insights-jobs', profile],
    refetchInterval: INSIGHTS_REFRESH_MS,
    staleTime: INSIGHTS_REFRESH_MS
  })

  const trend = analytics.data ? sessionTrend(analytics.data.daily, new Date()) : null
  const activeJobs = jobs.data ? jobs.data.filter(job => job.enabled).length : null
  const path = trend ? sparklinePath(trend.series, 240, 56) : ''

  return (
    <RailCard
      action={
        <span className="flex items-center gap-1.5 text-xs text-(--ui-text-tertiary)">
          {copy.live}
          <span aria-hidden="true" className="size-2 rounded-full bg-emerald-400" />
        </span>
      }
      icon={BarChart3}
      testId="insights"
      title={copy.title}
    >
      {trend && trend.total > 0 ? (
        <svg
          aria-hidden="true"
          className="mb-3 h-14 w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 240 56"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke={`url(#${gradientId})`} strokeLinecap="round" strokeWidth="2.5" />
        </svg>
      ) : (
        <p className="mb-3 text-xs text-(--ui-text-tertiary)">{copy.empty}</p>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col-reverse" title={copy.trendHint}>
          <dt className="text-xs text-(--ui-text-secondary)">
            {trend?.changePct == null ? copy.sessions : copy.trend}
          </dt>
          <dd
            className={cn(
              'text-2xl font-semibold tabular-nums',
              trend?.changePct == null
                ? 'text-(--ui-text-primary)'
                : trend.changePct >= 0
                  ? 'text-emerald-400'
                  : 'text-amber-400'
            )}
          >
            {trend?.changePct == null
              ? trend
                ? trend.total
                : '—'
              : `${trend.changePct >= 0 ? '+' : ''}${trend.changePct}%`}
          </dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-xs text-(--ui-text-secondary)">{copy.activeJobs}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-(--ui-text-primary)">{activeJobs ?? '—'}</dd>
        </div>
      </dl>
    </RailCard>
  )
}
