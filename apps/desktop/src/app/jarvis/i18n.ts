import type { Translations } from '@/i18n'

/**
 * The one navigation of the product: the shell's rail owns every destination,
 * the runtime's sidebar keeps only the conversations (see `$jarvisShellNav`).
 */
export const JARVIS_MAIN_VIEWS = ['jarvis', 'tasks', 'messaging', 'artifacts', 'memory', 'tools'] as const
export const JARVIS_AUXILIARY_VIEWS = ['settings', 'profile'] as const

export type JarvisMainView = (typeof JARVIS_MAIN_VIEWS)[number]
export type JarvisAuxiliaryView = (typeof JARVIS_AUXILIARY_VIEWS)[number]
export type JarvisShellView = JarvisMainView | JarvisAuxiliaryView

export type JarvisShellCopy = Translations['jarvisShell']
