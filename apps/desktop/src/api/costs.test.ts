import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  capabilityScoped: vi.fn(scope => ({ connectionId: scope.connectionId, profile: scope.profile })),
  hermesApi: vi.fn()
}))

const client = await import('./client')
const { getCosts, refreshCosts, CostsUnavailableError } = await import('./costs')

beforeEach(() => vi.clearAllMocks())

describe('cost API', () => {
  it('sends complete period, attribution, filters and captured scope', async () => {
    vi.mocked(client.hermesApi).mockResolvedValue({} as never)
    await getCosts(
      { from: 'a', to: 'b', attribution: 'desktop', provider: 'openrouter', limit: 20 },
      { connectionId: 'remote-a', profile: 'research' }
    )
    expect(client.hermesApi).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'remote-a',
        profile: 'research',
        path: '/api/analytics/costs?from=a&to=b&attribution=desktop&provider=openrouter&limit=20'
      })
    )
  })

  it('turns unsupported endpoints into an unavailable error, not zero spend', async () => {
    vi.mocked(client.hermesApi).mockRejectedValue(new Error('404 Not Found'))
    await expect(
      getCosts({ from: 'a', to: 'b', attribution: 'desktop' }, { connectionId: 'local', profile: 'default' })
    ).rejects.toBeInstanceOf(CostsUnavailableError)
  })

  it('refreshes through the separate reconciliation endpoint', async () => {
    vi.mocked(client.hermesApi).mockResolvedValue({} as never)
    await refreshCosts({ from: 'a', to: 'b', max_records: 100 }, { connectionId: 'local', profile: 'default' })
    expect(client.hermesApi).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/analytics/costs/refresh' })
    )
  })
})
