// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as Hermes from '@/hermes'
import { I18nProvider } from '@/i18n'

import { SkillsSummary } from './skills-summary'

const getSkills = vi.fn()

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<typeof Hermes>()),
  getSkills: (scope: Hermes.ProfileScope) => getSkills(scope)
}))

function renderSummary(onManageSkills = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return {
    onManageSkills,
    ...render(
      <I18nProvider configClient={null} initialLocale="en">
        <QueryClientProvider client={client}>
          <SkillsSummary onManageSkills={onManageSkills} scope={{ connectionId: 'remote-1', profile: 'default' }} />
        </QueryClientProvider>
      </I18nProvider>
    )
  }
}

afterEach(() => vi.clearAllMocks())

describe('SkillsSummary', () => {
  it('loads the selected backend scope and exposes recent skills plus management access', async () => {
    getSkills.mockResolvedValue([
      { category: 'research', description: 'Research', enabled: true, name: 'web-research', usage: 7 },
      { category: 'writing', description: 'Draft', enabled: true, name: 'drafts', usage: 2 },
      { category: 'other', description: 'Off', enabled: false, name: 'disabled', usage: 99 }
    ])
    const onManageSkills = vi.fn()

    renderSummary(onManageSkills)

    await waitFor(() => expect(getSkills).toHaveBeenCalledWith({ connectionId: 'remote-1', profile: 'default' }))
    expect(await screen.findByText('Web Research')).toBeTruthy()
    expect(screen.getByText('×7')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage skills' }))
    expect(onManageSkills).toHaveBeenCalledTimes(1)
  })
})
