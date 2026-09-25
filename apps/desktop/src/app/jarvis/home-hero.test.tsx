import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { pl } from '@/i18n/pl'

import { JarvisHomeHero } from './home-hero'

const insert = vi.hoisted(() => vi.fn())

vi.mock('../chat/composer/focus', () => ({ requestComposerInsert: insert }))

function renderHero(props: Partial<React.ComponentProps<typeof JarvisHomeHero>> = {}) {
  const onStartListening = vi.fn()

  render(
    <I18nProvider configClient={null} initialLocale="pl">
      <JarvisHomeHero connected listening={false} onStartListening={onStartListening} {...props} />
    </I18nProvider>
  )

  return { onStartListening }
}

afterEach(() => {
  cleanup()
  insert.mockReset()
  window.localStorage.clear()
})

describe('JarvisHomeHero', () => {
  it('greets the profile by name', () => {
    renderHero({ profileDisplayName: 'Chris' })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`${pl.jarvisShell.home.greetingLead}, Chris`)
  })

  it('offers at most three shortcuts, and a shortcut only fills the composer', () => {
    renderHero()

    const shortcuts = within(screen.getByRole('navigation', { name: pl.jarvisShell.home.shortcutsLabel })).getAllByRole(
      'button'
    )

    expect(shortcuts.length).toBeGreaterThan(0)
    expect(shortcuts.length).toBeLessThanOrEqual(3)

    fireEvent.click(shortcuts[0])

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][1]).toMatchObject({ target: 'main' })
  })

  it('cannot start a conversation while the engine is disconnected', () => {
    const { onStartListening } = renderHero({ connected: false })
    const talk = screen.getByRole('button', { name: pl.jarvisShell.home.talk })

    expect((talk as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('jarvis-home-status').textContent).toContain(pl.jarvisShell.home.offline)

    fireEvent.click(talk)
    expect(onStartListening).not.toHaveBeenCalled()
  })
})
