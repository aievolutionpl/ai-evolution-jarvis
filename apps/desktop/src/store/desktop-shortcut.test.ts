import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  $desktopShortcut,
  canManageDesktopShortcut,
  createDesktopShortcut,
  loadDesktopShortcutState
} from './desktop-shortcut'

function installBridge(bridge: unknown) {
  Object.defineProperty(window, 'hermesDesktop', { configurable: true, value: bridge, writable: true })
}

afterEach(() => {
  Reflect.deleteProperty(window, 'hermesDesktop')
  $desktopShortcut.set({ failed: false, kind: 'desktop-entry', path: '', present: null })
})

describe('desktop shortcut store', () => {
  it('hides itself when the build has no shell to write an icon with', async () => {
    expect(canManageDesktopShortcut()).toBe(false)

    // No bridge must be a no-op, not a crash: the settings page still renders.
    await loadDesktopShortcutState()
    expect(await createDesktopShortcut()).toBe(false)
    expect($desktopShortcut.get().present).toBeNull()
  })

  it('adopts what main reports rather than guessing a path', async () => {
    installBridge({
      desktopShortcut: {
        create: vi.fn(),
        get: vi.fn(async () => ({
          kind: 'desktop-entry',
          path: '/home/ada/Pulpit/ai-evolution-jarvis.desktop',
          present: true
        }))
      }
    })

    await loadDesktopShortcutState()

    expect($desktopShortcut.get()).toEqual({
      failed: false,
      kind: 'desktop-entry',
      path: '/home/ada/Pulpit/ai-evolution-jarvis.desktop',
      present: true
    })
  })

  it('surfaces a refused write instead of reporting success', async () => {
    installBridge({
      desktopShortcut: {
        create: vi.fn(async () => ({
          kind: 'desktop-entry',
          path: '/read-only/Desktop/ai-evolution-jarvis.desktop',
          present: false,
          reason: 'EROFS',
          status: 'failed'
        })),
        get: vi.fn()
      }
    })

    expect(await createDesktopShortcut()).toBe(false)
    expect($desktopShortcut.get().failed).toBe(true)
  })

  it('reports the icon as present once main says it wrote one', async () => {
    installBridge({
      desktopShortcut: {
        create: vi.fn(async () => ({
          kind: 'lnk',
          path: 'C:\\Users\\Ada\\Desktop\\Agent Czesiek.lnk',
          present: true,
          status: 'created'
        })),
        get: vi.fn()
      }
    })

    expect(await createDesktopShortcut()).toBe(true)
    expect($desktopShortcut.get()).toMatchObject({ failed: false, kind: 'lnk', present: true })
  })

  it('does not wedge the row when the bridge throws', async () => {
    installBridge({
      desktopShortcut: {
        create: vi.fn(async () => {
          throw new Error('ipc gone')
        }),
        get: vi.fn(async () => {
          throw new Error('ipc gone')
        })
      }
    })

    await loadDesktopShortcutState()
    expect($desktopShortcut.get().present).toBeNull()
    expect(await createDesktopShortcut()).toBe(false)
    expect($desktopShortcut.get().failed).toBe(true)
  })
})
