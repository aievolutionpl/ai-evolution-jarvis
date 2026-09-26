import { describe, expect, it } from 'vitest'

import { hitTestMemoryProjection, projectMemoryGraph } from './projection'

const camera = { yaw: 0, pitch: 0, distance: 600, focal_length: 600, near: 10, zoom: 1, pan_x: 0, pan_y: 0 }

describe('memory projection', () => {
  it('sorts farthest-first and picks the nearest overlapping visible node', () => {
    const projection = projectMemoryGraph(
      [
        { id: 'near', x: 0, y: 0, z: -40, radius: 24 },
        { id: 'far', x: 0, y: 0, z: 40, radius: 24 }
      ],
      camera,
      { width: 800, height: 600 }
    )

    expect(projection.nodes.map(node => node.id)).toEqual(['far', 'near'])
    expect(hitTestMemoryProjection(projection, 400, 300)).toBe('near')
  })

  it('culls points behind the near plane without changing the other points', () => {
    const projection = projectMemoryGraph(
      [
        { id: 'visible', x: 0, y: 0, z: 0, radius: 10 },
        { id: 'behind-near', x: 0, y: 0, z: -599, radius: 10 }
      ],
      camera,
      { width: 800, height: 600 }
    )

    expect(projection.nodes.find(node => node.id === 'visible')?.visible).toBe(true)
    expect(projection.nodes.find(node => node.id === 'behind-near')?.visible).toBe(false)
    expect(hitTestMemoryProjection(projection, 400, 300)).toBe('visible')
  })
})
