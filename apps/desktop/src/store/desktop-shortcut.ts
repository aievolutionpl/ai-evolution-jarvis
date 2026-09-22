/**
 * The desktop icon, as the renderer sees it.
 *
 * The MAIN process is authoritative: it owns the filesystem, the Windows shell
 * API and the once-per-installation first-run attempt. This module only caches
 * what main last reported so the Settings row can render it, and forwards the
 * "put it back" request — the same authority split as keep-awake and quick
 * entry.
 *
 * Every field is optional-safe: on a web/dev build there is no bridge at all,
 * and the row hides itself rather than pretending the icon exists.
 */

import { atom } from 'nanostores'

/** How this platform represents a desktop icon. */
export type DesktopShortcutKind = 'alias' | 'desktop-entry' | 'lnk'

export type DesktopShortcutStatus = 'created' | 'exists' | 'failed' | 'replaced' | 'unsupported'

export interface DesktopShortcutState {
  kind: DesktopShortcutKind
  /** null until main has answered once — the row shows a skeleton until then. */
  present: boolean | null
  path: string
  /** Set when the last create attempt failed, so the row can say so. */
  failed: boolean
}

export interface DesktopShortcutReport {
  kind: DesktopShortcutKind
  path: string
  present: boolean
  reason?: string
  status?: DesktopShortcutStatus
}

export const $desktopShortcut = atom<DesktopShortcutState>({
  failed: false,
  kind: 'desktop-entry',
  path: '',
  present: null
})

function bridge() {
  return globalThis.window?.hermesDesktop?.desktopShortcut
}

/** True when this build can place an icon at all (the Electron shell). */
export function canManageDesktopShortcut(): boolean {
  return Boolean(bridge())
}

function adopt(report: DesktopShortcutReport | undefined, failed: boolean): void {
  if (!report) {
    return
  }

  $desktopShortcut.set({
    failed,
    kind: report.kind,
    path: String(report.path || ''),
    present: report.present === true
  })
}

export async function loadDesktopShortcutState(): Promise<void> {
  const api = bridge()

  if (!api) {
    return
  }

  try {
    adopt(await api.get(), false)
  } catch {
    // A bridge that cannot answer is not a reason to block the settings page;
    // the row keeps its skeleton and the button still works.
    void 0
  }
}

/**
 * Ask main to (re)create the icon. Resolves to whether one is now on the
 * desktop, so the caller can react without re-reading the atom.
 */
export async function createDesktopShortcut(): Promise<boolean> {
  const api = bridge()

  if (!api) {
    return false
  }

  try {
    const report = await api.create()
    const failed = report?.status === 'failed' || report?.status === 'unsupported'
    adopt(report, failed)

    return report?.present === true
  } catch {
    $desktopShortcut.set({ ...$desktopShortcut.get(), failed: true })

    return false
  }
}
