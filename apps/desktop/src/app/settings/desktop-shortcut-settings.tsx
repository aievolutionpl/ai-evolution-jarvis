import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Check, Loader2, Monitor } from '@/lib/icons'
import {
  $desktopShortcut,
  canManageDesktopShortcut,
  createDesktopShortcut,
  loadDesktopShortcutState
} from '@/store/desktop-shortcut'

import { ListRow } from './primitives'

/**
 * "Skrót na pulpicie" — the row that puts the icon back.
 *
 * The app already creates it once on first run; this is for everyone the first
 * run could not serve: a macOS install (where the icon is never automatic), a
 * user who deleted it and changed their mind, and a desktop folder that was
 * read-only at the time. Main is authoritative, so the row shows the path it
 * reports rather than guessing one.
 */
export function DesktopShortcutSettings() {
  const { t } = useI18n()
  const copy = t.settings.desktopShortcut
  const state = useStore($desktopShortcut)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    void loadDesktopShortcutState()
  }, [])

  if (!canManageDesktopShortcut()) {
    return null
  }

  const run = async () => {
    setWorking(true)

    try {
      await createDesktopShortcut()
    } finally {
      setWorking(false)
    }
  }

  const status = state.failed
    ? copy.failed
    : state.present === null
      ? null
      : state.present
        ? copy.present
        : copy.missing

  return (
    <ListRow
      action={
        <Button className="min-h-11" disabled={working} onClick={() => void run()} type="button" variant="secondary">
          {working ? <Loader2 className="size-4 animate-spin" /> : <Monitor className="size-4" />}
          {state.present ? copy.recreate : copy.create}
        </Button>
      }
      below={
        status ? (
          <div
            className="mt-1 flex items-center gap-1.5 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)"
            role="status"
          >
            {state.present && !state.failed ? <Check className="size-3.5" /> : null}
            {status}
          </div>
        ) : null
      }
      description={copy.description}
      // The resolved path is the proof: on Linux the desktop folder is
      // localized (Pulpit, Bureau, …) and "somewhere on your desktop" is not
      // an answer when the icon did not show up.
      hint={state.path || undefined}
      title={copy.title}
    />
  )
}
