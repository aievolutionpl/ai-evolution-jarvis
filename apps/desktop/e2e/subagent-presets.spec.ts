import { expect, test } from '@playwright/test'

import { setupMockBackend, waitForAppReady } from './fixtures'

test('subagent presets remain scoped and prepare a user task', async () => {
  const backend = await setupMockBackend()

  try {
    await waitForAppReady(backend)
    await backend.page.goto('/agents')
    await expect(backend.page.getByText('Ready to help')).toBeVisible()
    await expect(backend.page.getByText('Marketing')).toBeVisible()
  } finally {
    await backend.cleanup()
  }
})
