import type { CostTotals, ModelCostGroup, RequestCostRow, SessionCostGroup, WorkCostGroup } from '@/api/costs'

function money(value: string | null): string {
  return value === null ? '—' : `$${value}`
}

function tokenTotal(tokens: CostTotals['tokens']): number {
  return [
    tokens.input_tokens,
    tokens.output_tokens,
    tokens.cache_read_tokens,
    tokens.cache_write_tokens
  ].reduce<number>((total, value) => total + (value ?? 0), 0)
}

export function CostTotalsGrid({ totals }: { totals: CostTotals }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="cost-totals">
      <Metric label="Confirmed" value={money(totals.confirmed_usd)} />
      <Metric label="Estimated" value={money(totals.estimated_usd)} />
      <Metric label="Unknown records" value={String(totals.unknown_requests)} />
      <Metric label="Tokens" value={tokenTotal(totals.tokens).toLocaleString()} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-(--ui-text-tertiary)">{label}</div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  )
}

export function CostBreakdown({
  byModel,
  bySession,
  byWork,
  onOpenSession
}: {
  byModel: readonly ModelCostGroup[]
  bySession: readonly SessionCostGroup[]
  byWork: readonly WorkCostGroup[]
  onOpenSession: (sessionId: string) => void
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3" data-testid="cost-breakdown">
      <BreakdownTable
        rows={byWork.map(row => ({
          id: row.work_session_id ?? 'unknown',
          label: row.work_session_id ?? 'Unknown work',
          totals: row
        }))}
        title="Work"
      />
      <BreakdownTable
        onOpenSession={onOpenSession}
        rows={bySession.map(row => ({
          id: row.session_id,
          label: row.session_id,
          totals: row,
          sessionId: row.session_id
        }))}
        title="Sessions"
      />
      <BreakdownTable
        rows={byModel.map(row => ({
          id: `${row.provider ?? 'unknown'}:${row.model ?? 'unknown'}`,
          label: row.model ?? 'Unknown model',
          totals: row
        }))}
        title="Models"
      />
    </div>
  )
}

function BreakdownTable({
  title,
  rows,
  onOpenSession
}: {
  title: string
  rows: Array<{ id: string; label: string; totals: CostTotals; sessionId?: string }>
  onOpenSession?: (sessionId: string) => void
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-(--ui-text-tertiary)">
        {title}
      </h3>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-(--ui-text-tertiary)">
            <th className="pb-1 font-normal">Item</th>
            <th className="pb-1 text-right font-normal">Spend</th>
            <th className="pb-1 text-right font-normal">Requests</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr className="border-t border-(--ui-stroke-tertiary)" key={row.id}>
              <td className="max-w-36 truncate py-2 text-foreground">
                {row.sessionId && onOpenSession ? (
                  <button
                    className="underline-offset-2 hover:underline focus-visible:underline"
                    onClick={() => onOpenSession(row.sessionId!)}
                    type="button"
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </td>
              <td className="py-2 text-right text-(--ui-text-secondary)">{money(row.totals.confirmed_usd)}</td>
              <td className="py-2 text-right text-(--ui-text-tertiary)">{row.totals.request_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-xs text-(--ui-text-tertiary)">No records</p>}
    </section>
  )
}

export function CostRows({
  rows,
  onOpenSession
}: {
  rows: readonly RequestCostRow[]
  onOpenSession: (id: string) => void
}) {
  return (
    <section>
      <h3 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-(--ui-text-tertiary)">
        Request details
      </h3>
      <ul className="divide-y divide-(--ui-stroke-tertiary) text-xs">
        {rows.map(row => (
          <li className="flex items-center justify-between gap-3 py-2" key={row.record_id}>
            <button
              className="min-w-0 truncate text-left text-foreground underline-offset-2 hover:underline focus-visible:underline"
              onClick={() => onOpenSession(row.session_id)}
              type="button"
            >
              {row.model ?? row.provider ?? 'Unknown request'}
            </button>
            <span className="shrink-0 text-(--ui-text-secondary)">
              {money(row.reconciled_cost_usd ?? row.reported_cost_usd ?? row.estimated_cost_usd)} · {row.cost_status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
