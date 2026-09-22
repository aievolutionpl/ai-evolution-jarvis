/**
 * The Jarvis playbook — "co mogę Ci zlecić?" as data.
 *
 * Every entry is one thing a user can actually hand to Jarvis right now, and
 * the catalog is deliberately capability-gated: an entry that needs a toolset
 * the machine has not been given is not shown as a teaser, it is simply not
 * offered. Suggesting "zrób zrzut ekranu" to someone who never enabled desktop
 * control would be an advert, not a tip.
 *
 * The copy lives in the locale files, keyed by id, so this module stays a pure
 * ranking function the tests can pin without a translation provider.
 */

import type { JarvisComputerMode } from './computer-capabilities'
import { computerModeNeedsDesktopControl } from './computer-capabilities'

export type JarvisPlaybookCategory = 'automation' | 'computer' | 'files' | 'memory' | 'voice' | 'web'

/** What a machine must already be allowed to do before an entry is offered. */
export type JarvisPlaybookRequirement = 'desktop-control' | 'workspace'

/** Catalog keys. A union so the locale files cannot miss one. */
export type JarvisPlaybookId =
  | 'automation.delegate'
  | 'automation.morningBrief'
  | 'automation.weeklyBackup'
  | 'computer.cleanDesktop'
  | 'computer.describeScreen'
  | 'computer.fillForm'
  | 'files.diskCheckup'
  | 'files.fixProject'
  | 'files.sortDownloads'
  | 'files.summarizeDocument'
  | 'memory.recallSession'
  | 'memory.remember'
  | 'voice.handsFree'
  | 'web.fillReport'
  | 'web.research'
  | 'web.watchPrice'

export interface JarvisPlaybookEntry {
  category: JarvisPlaybookCategory
  id: JarvisPlaybookId
  /** Offered before the session has any history — the cold-start deck. */
  starter?: boolean
  requires?: JarvisPlaybookRequirement
}

export const JARVIS_PLAYBOOK: readonly JarvisPlaybookEntry[] = [
  { category: 'computer', id: 'computer.describeScreen', requires: 'desktop-control', starter: true },
  { category: 'computer', id: 'computer.fillForm', requires: 'desktop-control' },
  { category: 'computer', id: 'computer.cleanDesktop', requires: 'desktop-control' },
  { category: 'files', id: 'files.sortDownloads', requires: 'workspace', starter: true },
  { category: 'files', id: 'files.summarizeDocument', requires: 'workspace' },
  { category: 'files', id: 'files.fixProject', requires: 'workspace' },
  { category: 'files', id: 'files.diskCheckup', requires: 'workspace' },
  { category: 'web', id: 'web.research', starter: true },
  { category: 'web', id: 'web.watchPrice' },
  { category: 'web', id: 'web.fillReport' },
  { category: 'automation', id: 'automation.morningBrief' },
  { category: 'automation', id: 'automation.weeklyBackup', requires: 'workspace' },
  { category: 'automation', id: 'automation.delegate' },
  { category: 'memory', id: 'memory.remember', starter: true },
  { category: 'memory', id: 'memory.recallSession' },
  { category: 'voice', id: 'voice.handsFree' }
]

export interface JarvisPlaybookContext {
  /** null before the user has been through the computer step. */
  computerMode: JarvisComputerMode | null
  dismissedIds?: readonly string[]
  /** The session has produced at least one real event. */
  hasHistory?: boolean
}

/** Modes that hand Jarvis the filesystem and a terminal. */
function hasWorkspace(mode: JarvisComputerMode | null): boolean {
  return mode === 'assist' || mode === 'operator'
}

function meetsRequirement(entry: JarvisPlaybookEntry, mode: JarvisComputerMode | null): boolean {
  if (entry.requires === 'desktop-control') {
    return mode !== null && computerModeNeedsDesktopControl(mode)
  }

  if (entry.requires === 'workspace') {
    return hasWorkspace(mode)
  }

  return true
}

/**
 * The deck for this moment: what this machine is allowed to do, minus what the
 * user has waved away, ordered so a cold start leads with the starter entries.
 */
export function selectJarvisPlaybook(
  context: JarvisPlaybookContext,
  { limit }: { limit?: number } = {}
): JarvisPlaybookEntry[] {
  const dismissed = new Set(context.dismissedIds ?? [])

  const available = JARVIS_PLAYBOOK.filter(
    entry => !dismissed.has(entry.id) && meetsRequirement(entry, context.computerMode)
  )

  const ranked = context.hasHistory
    ? available
    : [...available].sort((a, b) => Number(Boolean(b.starter)) - Number(Boolean(a.starter)))

  return typeof limit === 'number' ? ranked.slice(0, Math.max(0, limit)) : ranked
}

/** Categories present in a deck, in catalog order — the panel's filter row. */
export function jarvisPlaybookCategories(entries: readonly JarvisPlaybookEntry[]): JarvisPlaybookCategory[] {
  const seen: JarvisPlaybookCategory[] = []

  for (const entry of entries) {
    if (!seen.includes(entry.category)) {
      seen.push(entry.category)
    }
  }

  return seen
}
