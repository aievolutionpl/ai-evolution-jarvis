import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { PageLoader } from '@/components/page-loader'
import { useI18n } from '@/i18n'
import {
  $starmapError,
  $starmapGeneration,
  $starmapGraph,
  $starmapLoading,
  $starmapOwner,
  loadStarmapGraph
} from '@/store/starmap'
import type { StarmapGraph } from '@/types/hermes'

import { Panel, PanelEmpty } from '../overlays/panel'

import { MemoryList } from './memory-list'
import { StarMap } from './star-map'
import type { MemoryGraphSource } from './types'

// Star map overlay: a top-down map of what Hermes has learned for a profile,
// over a radial time axis. Data is fetched on demand into the $starmap* atoms;
// the map itself lives in ./star-map. The chrome is owned by the map itself
// (timeline scrubber + legend float over the canvas), so there's no panel
// header here.
export function StarmapView({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const graph = useStore($starmapGraph)
  const loading = useStore($starmapLoading)
  const error = useStore($starmapError)
  const owner = useStore($starmapOwner)
  const generation = useStore($starmapGeneration)
  const location = useLocation()
  const navigate = useNavigate()

  // A pasted share code populates the map with someone else's (or an exported)
  // graph, overriding the live profile scan. Cleared by "back to my map" and
  // whenever a fresh profile graph loads in.
  const [imported, setImported] = useState<StarmapGraph | null>(null)
  const view = new URLSearchParams(location.search).get('view') === 'list' ? 'list' : 'graph'

  useEffect(() => {
    void loadStarmapGraph()
  }, [])

  // Drop a stale import when the underlying profile graph changes out from under it.
  useEffect(() => {
    setImported(null)
  }, [graph])

  const shown = imported ?? graph

  const source = useMemo<MemoryGraphSource | null>(() => {
    if (imported) {
      return { kind: 'imported', import_id: 'shared-map', graph: imported }
    }

    if (graph) {
      return { kind: 'owned', owner: owner ?? { connectionId: 'local', profile: 'default' }, generation, graph }
    }

    return null
  }, [generation, graph, imported, owner])

  const chooseView = (next: 'graph' | 'list') => {
    const params = new URLSearchParams(location.search)
    params.set('view', next)
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

  return (
    <Panel closeLabel={t.starmap.close} onClose={onClose}>
      {error ? (
        <PanelEmpty description={error} icon="warning" title={t.starmap.loadFailed} />
      ) : !shown && loading ? (
        <PageLoader aria-label={t.starmap.loading} className="min-h-0 flex-1" />
      ) : shown && shown.nodes.length === 0 && !imported ? (
        <PanelEmpty description={t.starmap.emptyDesc} icon="lightbulb" title={t.starmap.emptyTitle} />
      ) : shown ? (
        <>
          <div className="pointer-events-auto absolute right-14 top-2 z-30 flex gap-1 [-webkit-app-region:no-drag]">
            <button
              aria-pressed={view === 'graph'}
              className="rounded border px-2 py-1 text-xs"
              onClick={() => chooseView('graph')}
              type="button"
            >
              {t.starmap.title}
            </button>
            <button
              aria-pressed={view === 'list'}
              className="rounded border px-2 py-1 text-xs"
              onClick={() => chooseView('list')}
              type="button"
            >
              {t.starmap.memory}
            </button>
          </div>
          {view === 'list' && source ? (
            <MemoryList source={source} />
          ) : (
            <StarMap
              graph={shown}
              imported={imported !== null}
              onImport={setImported}
              onResetMap={() => setImported(null)}
              source={source ?? undefined}
            />
          )}
        </>
      ) : null}
    </Panel>
  )
}
