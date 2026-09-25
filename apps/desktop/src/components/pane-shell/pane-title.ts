import type { Translations } from '@/i18n'

type PaneNames = Translations['zones']['paneNames']

/** Built-in panes register a plain English id-like title; show it in the UI language. */
const BUILT_IN: Record<string, keyof PaneNames> = {
  bots: 'bots',
  files: 'files',
  logs: 'logs',
  review: 'review',
  sessions: 'sessions',
  terminal: 'terminal'
}

export function localizePaneTitle(title: string | undefined, fallback: string, names: PaneNames): string {
  const raw = title ?? fallback
  const key = BUILT_IN[raw.trim().toLowerCase()]

  return key ? names[key] : raw
}
