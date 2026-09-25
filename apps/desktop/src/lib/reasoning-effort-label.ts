// Own module: the i18n catalog (via settings constants) imports reasoning-effort,
// so the translated label cannot live there without an import cycle.
import { translateNow } from '@/i18n/runtime'
import { normalize } from '@/lib/text'

/** Compact labels for chrome where space is tight (pill, picker rows), in the
 *  UI language (`shell.effortShort`). Menus and settings use the longer
 *  `shell.modelOptions` strings. */
const SHORT_LABEL_KEYS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'])

export function reasoningEffortLabel(effort: string): string {
  const key = normalize(effort)

  if (!key) {
    return ''
  }

  return SHORT_LABEL_KEYS.has(key) ? translateNow(`shell.effortShort.${key}`) : effort
}
