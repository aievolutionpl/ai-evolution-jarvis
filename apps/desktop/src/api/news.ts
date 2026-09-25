import { hermesApi } from './client'

/** One headline from the backend's aggregated RSS/Atom feeds (`GET /api/news`). */
export interface AiNewsItem {
  link: string
  /** Unix seconds; null when the feed omitted a date. */
  published: null | number
  source: string
  summary: string
  title: string
}

export interface AiNewsFeedStatus {
  count: number
  error: null | string
  name: string
  ok: boolean
  url: string
}

export interface AiNewsResponse {
  feeds: AiNewsFeedStatus[]
  fetched_at: number
  items: AiNewsItem[]
  total: number
}

/**
 * The feeds are configured under `dashboard.news_feeds` and cached server-side
 * for 15 minutes, so polling this never reaches the upstream sites directly.
 */
export function getAiNews(limit = 8): Promise<AiNewsResponse> {
  return hermesApi<AiNewsResponse>({ path: `/api/news?limit=${Math.max(1, Math.floor(limit))}` })
}
