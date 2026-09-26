export interface PresetSkillReference {
  name: string
}

export interface SubagentPreset {
  id: string
  name: string
  character: string
  skills: PresetSkillReference[]
  created_at: string
  updated_at: string
}

export interface SubagentPresetMetadata {
  schema_version: 1
  presets: SubagentPreset[]
}

export interface PresetSkillAvailability {
  name: string
  state: 'enabled' | 'disabled' | 'missing'
}

export const PRESET_METADATA_KEY = 'agent-czesiek.subagent-presets' as const

const CATALOG: readonly Omit<SubagentPreset, 'created_at' | 'updated_at'>[] = [
  {
    id: 'marketing',
    name: 'Marketing',
    character: 'Prepare concise, review-ready drafts for the user. Keep claims grounded and never publish anything.',
    skills: [{ name: 'brand-post-system' }]
  },
  {
    id: 'research',
    name: 'Research',
    character: 'Investigate carefully, distinguish evidence from inference, and cite sources for the user to review.',
    skills: [{ name: 'grounded-citations' }]
  },
  {
    id: 'competitor-monitoring',
    name: 'Competitor monitoring',
    character: 'Monitor named competitors for material developments and return a cited digest. Do not contact anyone.',
    skills: [{ name: 'competitor-news-monitor' }]
  }
]

export function initialPresetMetadata(now = new Date().toISOString()): SubagentPresetMetadata {
  return {
    schema_version: 1,
    presets: CATALOG.map(preset => ({ ...preset, created_at: now, updated_at: now }))
  }
}

export function normalizePresetMetadata(value: unknown): SubagentPresetMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { schema_version: 1, presets: [] }
  }

  const raw = value as { schema_version?: unknown; presets?: unknown }

  if (raw.schema_version !== 1 || !Array.isArray(raw.presets)) {
    return { schema_version: 1, presets: [] }
  }

  const presets = raw.presets.filter((preset): preset is SubagentPreset => {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {return false}
    const candidate = preset as Record<string, unknown>

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.character === 'string' &&
      typeof candidate.created_at === 'string' &&
      typeof candidate.updated_at === 'string' &&
      Array.isArray(candidate.skills) &&
      candidate.skills.every(skill => Boolean(skill && typeof skill === 'object' && typeof (skill as { name?: unknown }).name === 'string'))
    )
  })

  return { schema_version: 1, presets }
}

export function skillAvailability(
  references: readonly PresetSkillReference[],
  installed: readonly { name: string; enabled: boolean }[]
): PresetSkillAvailability[] {
  const byName = new Map(installed.map(skill => [skill.name, skill.enabled]))

  return references.map(({ name }) => ({
    name,
    state: byName.has(name) ? (byName.get(name) ? 'enabled' : 'disabled') : 'missing'
  }))
}
