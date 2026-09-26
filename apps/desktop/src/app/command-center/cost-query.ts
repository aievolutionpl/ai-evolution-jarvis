import type { CostScope, CostsQuery } from '@/api/costs'

export interface CostQueryState extends CostsQuery {
  provider: string
  session_id: string
  work_session_id: string
  work_turn_id: string
}

export function periodForDays(days: number, now = new Date()): { from: string; to: string } {
  const to = new Date(now)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - Math.max(1, Math.round(days)))

  return { from: from.toISOString(), to: to.toISOString() }
}

export function createCostQuery(days = 30, now = new Date()): CostQueryState {
  return {
    ...periodForDays(days, now),
    attribution: 'desktop',
    provider: '',
    session_id: '',
    work_session_id: '',
    work_turn_id: '',
    limit: 100
  }
}

export function costQueryKey(scope: CostScope, query: CostsQuery): readonly unknown[] {
  return [
    'costs',
    scope.connectionId,
    scope.profile,
    query.from,
    query.to,
    query.attribution,
    query.provider ?? '',
    query.session_id ?? '',
    query.work_session_id ?? '',
    query.work_turn_id ?? '',
    query.cursor ?? '',
    query.limit ?? null
  ]
}

export function queryWithFilters(state: CostQueryState): CostsQuery {
  return {
    from: state.from,
    to: state.to,
    attribution: state.attribution,
    ...(state.provider ? { provider: state.provider } : {}),
    ...(state.session_id ? { session_id: state.session_id } : {}),
    ...(state.work_session_id ? { work_session_id: state.work_session_id } : {}),
    ...(state.work_turn_id ? { work_turn_id: state.work_turn_id } : {}),
    limit: state.limit
  }
}
