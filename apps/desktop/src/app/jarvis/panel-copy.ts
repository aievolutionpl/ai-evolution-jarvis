/**
 * Copy contracts for the insight views.
 *
 * Declared structurally rather than pulled off `Translations` so each view can
 * be rendered in a test with a hand-written fixture, and so a locale change
 * cannot silently reshape a component's props.
 */

import type { JarvisChartCopy } from './charts'
import type { JarvisNewsCopy } from './news'

export interface JarvisStatsCopy {
  chart: JarvisChartCopy
  countsLabel: string
  duration: (ms: number) => string
  empty: string
  failed: string
  medianToolTime: string
  notMeasured: string
  toolRuns: string
  verified: string
}

export interface JarvisNewsViewCopy extends JarvisNewsCopy {
  empty: string
  openUpdate: string
  title: string
}

export type JarvisInsightsView = 'activity' | 'news' | 'stats'

export interface JarvisInsightsTabCopy {
  activity: string
  news: string
  stats: string
}
