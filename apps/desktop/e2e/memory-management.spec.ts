import { expect, test } from './test'

import { type MockBackendFixture, setupMockBackend, waitForAppReady } from './fixtures'

let fixture: MockBackendFixture | null = null

const graph = {
  nodes: [
    { id: 'memory:profile:0', label: 'Remember the release checklist', kind: 'memory', category: 'memory', useCount: 1, state: 'active', createdBy: null, pinned: false },
    { id: 'skill:release:0', label: 'Release checklist', kind: 'skill', category: 'release', useCount: 2, state: 'active', createdBy: null, pinned: false }
  ],
  edges: [{ source: 'memory:profile:0', target: 'skill:release:0' }],
  clusters: [{ category: 'release', count: 2 }],
  memory: [],
  stats: {}
}

async function dismissOnboarding(): Promise<void> {
  const page = fixture!.page
  const onboarding = page.locator('[data-testid="jarvis-onboarding"]')

  if (await onboarding.count()) {
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ai-evolution-jarvis-onboarding-v1:')) {
          localStorage.setItem(key, JSON.stringify({ version: 1, currentStep: 'approvals', completedSteps: ['profile', 'engine', 'model', 'voice', 'access', 'approvals'], selections: {} }))
        }
      }
      localStorage.setItem('ai-evolution-jarvis-onboarding-v1:local::default', JSON.stringify({ version: 1, currentStep: 'approvals', completedSteps: ['profile', 'engine', 'model', 'voice', 'access', 'approvals'], selections: {} }))
    })
    await page.reload()
  }

  await waitForAppReady(fixture!, 120_000)
}

test.beforeAll(async () => {
  fixture = await setupMockBackend()
  await dismissOnboarding()
  await fixture.page.route('**/api/learning/graph**', route => route.fulfill({ body: JSON.stringify(graph), contentType: 'application/json', status: 200 }))
  await fixture.page.goto(`${fixture.page.url().split('#')[0]}#/starmap`)
  await expect(fixture.page.locator('canvas')).toBeVisible({ timeout: 30_000 })
})

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test('memory graph keeps 2D rendering and exposes a searchable list', async () => {
  const page = fixture!.page

  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible()
  const contextTypes = await page.locator('canvas').evaluate(element => {
    const canvas = element as HTMLCanvasElement
    const original = canvas.getContext.bind(canvas)
    const calls: string[] = []
    canvas.getContext = ((type: string, ...args: unknown[]) => {
      calls.push(type)
      return original(type, ...(args as [never]))
    }) as typeof canvas.getContext
    return calls
  })
  expect(contextTypes).not.toContain('webgl')
  expect(contextTypes).not.toContain('webgl2')

  await page.getByRole('button', { name: 'List' }).click()
  await expect(page.getByRole('list')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search memory' }).fill('release')
  await expect(page.getByRole('button', { name: 'Remember the release checklist' })).toBeVisible()
  await page.getByRole('button', { name: 'Remember the release checklist' }).click()
  await expect(page.getByRole('article', { name: /Memory details for Remember/ })).toBeVisible()
})
