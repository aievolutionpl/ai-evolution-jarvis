import { useState } from 'react'

import { getLearningNode } from '@/hermes'

import { NodeContextMenu, type NodeMenuTarget } from './node-context-menu'
import type { MemoryGraphSource } from './types'

export function MemoryList({ source }: { source: MemoryGraphSource }) {
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<{ content: string; id: string; label: string } | null>(null)
  const [target, setTarget] = useState<NodeMenuTarget | null>(null)
  const nodes = source.graph.nodes.filter(node => {
    const value = `${node.label} ${node.kind}`.toLocaleLowerCase()
    return value.includes(query.toLocaleLowerCase())
  })

  const inspect = async (id: string, label: string) => {
    if (source.kind !== 'owned') {
      setDetail({ content: 'Imported memory is read-only; details are not available from this map.', id, label })

      return
    }

    try {
      const result = await getLearningNode(id, source.owner)
      setDetail({ content: result.content, id, label })
    } catch (error) {
      setDetail({ content: error instanceof Error ? error.message : String(error), id, label })
    }
  }

  return (
    <section aria-label="Memory list" className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <label className="text-xs text-muted-foreground">
        Search memory
        <input aria-label="Search memory" className="mt-1 w-full rounded border bg-transparent px-2 py-1 text-sm" onChange={event => setQuery(event.target.value)} value={query} />
      </label>
      <div className="min-h-0 overflow-auto" role="list">
        {nodes.map(node => (
          <div className="flex items-center gap-2 border-b py-2" key={node.id} role="listitem">
            <button className="min-w-0 flex-1 truncate text-left text-sm hover:underline" onClick={() => void inspect(node.id, node.label)} type="button">
              {node.label}
            </button>
            <button aria-label={`Edit ${node.label}`} className="rounded border px-2 py-1 text-xs" disabled={source.kind !== 'owned'} onClick={event => setTarget({ id: node.id, kind: node.kind, label: node.label, x: event.clientX, y: event.clientY })} type="button">
              Edit
            </button>
            <button aria-label={`Delete ${node.label}`} className="rounded border px-2 py-1 text-xs" disabled={source.kind !== 'owned'} onClick={event => setTarget({ id: node.id, kind: node.kind, label: node.label, x: event.clientX, y: event.clientY })} type="button">
              Delete
            </button>
          </div>
        ))}
      </div>
      {detail ? (
        <article aria-label={`Memory details for ${detail.label}`} className="max-h-48 overflow-auto rounded border p-3 text-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-medium">{detail.label}</h2>
            <button aria-label="Close memory details" onClick={() => setDetail(null)} type="button">×</button>
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{detail.content}</p>
        </article>
      ) : null}
      <NodeContextMenu onClose={() => setTarget(null)} onNodeRemoved={() => setTarget(null)} source={source} target={target} />
    </section>
  )
}
