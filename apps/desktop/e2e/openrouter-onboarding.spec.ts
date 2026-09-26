import { expect, test } from './test'
import { setupNoProvider } from './fixtures'

test('fresh setup opens the guided onboarding without optional settings screens', async () => {
  const fixture = await setupNoProvider()

  try {
    await expect(fixture.page.getByTestId('jarvis-onboarding')).toBeVisible({ timeout: 90_000 })
    await expect(fixture.page.getByTestId('jarvis-onboarding-welcome')).toBeVisible()
    await expect(fixture.page.getByText(/Get a key|Zdobądź klucz/)).toHaveCount(0)
  } finally {
    await fixture.cleanup()
  }
})
