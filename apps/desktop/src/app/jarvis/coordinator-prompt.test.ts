import { expect, test } from 'vitest'

import { withCoordinatorPrompt } from './coordinator-prompt'

test('preserves profile instructions and installs the coordinator role once', () => {
  const prompt = withCoordinatorPrompt('Mów zwięźle.')
  expect(prompt).toContain('Mów zwięźle.')
  expect(prompt).toContain('podagentowi')
  expect(withCoordinatorPrompt(prompt)).toBe(prompt)
})
