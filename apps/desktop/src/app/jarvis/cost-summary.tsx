import type { CostScope } from '@/api/costs'
import { Button } from '@/components/ui/button'

export interface CostSummaryProps {
  scope: CostScope
  onOpenCosts: () => void
}

export function CostSummary({ scope, onOpenCosts }: CostSummaryProps) {
  return (
    <section className="rounded-lg border border-(--ui-stroke-tertiary) p-3" data-testid="cost-summary">
      <div className="text-xs font-medium text-foreground">Costs</div>
      <p className="mt-1 text-xs text-(--ui-text-tertiary)">View request spend for {scope.profile}.</p>
      <Button className="mt-2" onClick={onOpenCosts} size="xs" variant="text">
        Open cost dashboard
      </Button>
    </section>
  )
}
