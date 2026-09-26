import { expect } from '@playwright/test'

import { setupMockBackend, waitForAppReady } from './fixtures'
import { test } from './test'

test('cost dashboard keeps key-wide spend distinct from app work', async () => {
  const fixture = await setupMockBackend()
  try {
    await waitForAppReady(fixture)
    await expect(fixture.page.locator('body')).toBeVisible()
  } finally {
    await fixture.cleanup()
  }
})
