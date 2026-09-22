import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import {
  $jarvisOnboardingCompletedAt,
  JARVIS_ONBOARDING_STEPS,
  JARVIS_ONBOARDING_VERSION,
  jarvisOnboardingStorageKey,
  markJarvisOnboardingCompleted
} from './onboarding-state'
import { JarvisTipsLauncher } from './tips'
import { jarvisTipsStorageKey, readJarvisTipsState } from './tips-state'

const SCOPE = { connectionId: 'local', profile: 'default' }

function persistOnboarding(computerMode?: string, complete = true) {
  window.localStorage.setItem(
    jarvisOnboardingStorageKey(SCOPE),
    JSON.stringify({
      version: JARVIS_ONBOARDING_VERSION,
      currentStep: 'approvals',
      completedSteps: complete ? [...JARVIS_ONBOARDING_STEPS] : ['profile'],
      selections: computerMode ? { computerMode } : {}
    })
  )
}

function renderLauncher(props: Partial<React.ComponentProps<typeof JarvisTipsLauncher>> = {}) {
  return render(
    <I18nProvider configClient={null} initialLocale="pl">
      <JarvisTipsLauncher scope={SCOPE} storage={window.localStorage} {...props} />
    </I18nProvider>
  )
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  $jarvisOnboardingCompletedAt.set(0)
})

describe('JarvisTipsLauncher', () => {
  it('introduces itself once after setup and not again', async () => {
    persistOnboarding('assist')
    renderLauncher()

    expect(await screen.findByTestId('jarvis-tips')).toBeTruthy()
    await waitFor(() => expect(readJarvisTipsState(window.localStorage, SCOPE).autoOpen).toBe(false))

    cleanup()
    renderLauncher()

    expect(screen.queryByTestId('jarvis-tips')).toBeNull()
  })

  it('appears as soon as setup finishes underneath it, not only on the next launch', async () => {
    persistOnboarding('assist', false)
    renderLauncher()

    expect(screen.queryByTestId('jarvis-tips')).toBeNull()

    // What the wizard does on its way out: writes completion, then signals it.
    persistOnboarding('assist')
    act(() => markJarvisOnboardingCompleted())

    expect(await screen.findByTestId('jarvis-tips')).toBeTruthy()
  })

  it('stays out of the way while setup is unfinished or a task is running', () => {
    persistOnboarding('assist', false)
    renderLauncher()
    expect(screen.queryByTestId('jarvis-tips')).toBeNull()

    cleanup()
    persistOnboarding('assist')
    renderLauncher({ busy: true })
    expect(screen.queryByTestId('jarvis-tips')).toBeNull()
    expect(readJarvisTipsState(window.localStorage, SCOPE).autoOpen).toBe(true)
  })

  it('only offers desktop work once desktop control was granted in setup', async () => {
    persistOnboarding('assist')
    renderLauncher()

    await screen.findByTestId('jarvis-tips')
    expect(screen.queryByText('Zobacz, co mam na ekranie')).toBeNull()
    expect(screen.getByText('Ogarnij folder Pobrane')).toBeTruthy()

    cleanup()
    window.localStorage.removeItem(jarvisTipsStorageKey(SCOPE))
    persistOnboarding('operator')
    renderLauncher()

    await screen.findByTestId('jarvis-tips')
    expect(screen.getByText('Zobacz, co mam na ekranie')).toBeTruthy()
  })

  it('fills the composer with the picked prompt instead of sending it', async () => {
    persistOnboarding('chat')
    const onUse = vi.fn()
    renderLauncher({ onUse })

    await screen.findByTestId('jarvis-tips')
    const card = screen.getByText('Zbadaj temat').closest('li') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Użyj' }))

    expect(onUse).toHaveBeenCalledWith('Sprawdź to dla mnie i podaj źródła: ')
    expect(screen.queryByTestId('jarvis-tips')).toBeNull()
  })

  it('remembers a hidden tip and can bring it back', async () => {
    persistOnboarding('chat')
    renderLauncher()

    await screen.findByTestId('jarvis-tips')
    fireEvent.click(screen.getByRole('button', { name: 'Ukryj podpowiedź „Zbadaj temat”' }))

    await waitFor(() => expect(screen.queryByText('Zbadaj temat')).toBeNull())
    expect(readJarvisTipsState(window.localStorage, SCOPE).dismissedIds).toEqual(['web.research'])

    fireEvent.click(screen.getByRole('button', { name: 'Przywróć ukryte' }))

    expect(await screen.findByText('Zbadaj temat')).toBeTruthy()
    expect(readJarvisTipsState(window.localStorage, SCOPE).dismissedIds).toEqual([])
  })
})
