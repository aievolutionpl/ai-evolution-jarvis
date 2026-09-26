import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test.describe('skills management', () => {
  test('opens the scoped skills surface and exposes search and management affordances', async () => {
    const fixture = await setupMockBackend()

    try {
      await waitForAppReady(fixture)
      await fixture.page.getByRole('link', { name: 'Skills' }).click()

      await expect(fixture.page.getByRole('heading', { name: /skills/i })).toBeVisible()
      await expect(fixture.page.getByPlaceholder(/search skills/i)).toBeVisible()
      await expect(fixture.page.getByText(/changes apply to new sessions/i)).toBeVisible()
    } finally {
      await fixture.cleanup()
    }
  })
})
