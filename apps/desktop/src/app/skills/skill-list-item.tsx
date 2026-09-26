import type { ReactNode } from 'react'

import { CapRow } from '@/app/master-detail'
import { prettyName } from '@/app/settings/helpers'
import { Badge } from '@/components/ui/badge'
import type { SkillInfo } from '@/types/hermes'

export interface SkillListItemProps {
  action?: ReactNode
  active: boolean
  busy?: boolean
  onSelect: () => void
  onToggle?: (enabled: boolean) => void
  skill: SkillInfo
  usageLabel?: ReactNode
}

function sourceLabel(skill: SkillInfo): ReactNode {
  return (
    <>
      <span className="truncate">{prettyName(skill.category || 'general')}</span>
      {skill.provenance && skill.provenance !== 'bundled' ? (
        <Badge className="shrink-0 normal-case" variant={skill.provenance === 'agent' ? 'default' : 'muted'}>
          {skill.provenance === 'agent' ? 'learned' : 'hub'}
        </Badge>
      ) : null}
    </>
  )
}

function displayName(name: string): string {
  return prettyName(name.replace(/-/g, '_'))
}

/** A compact, readable skill row shared by installed-skill presentations. */
export function SkillListItem({ action, active, busy, onSelect, onToggle, skill, usageLabel }: SkillListItemProps) {
  return (
    <CapRow
      action={action}
      active={active}
      busy={busy}
      enabled={skill.enabled}
      meta={usageLabel}
      onSelect={onSelect}
      onToggle={onToggle}
      subtitle={sourceLabel(skill)}
      title={displayName(skill.name)}
      toggleLabel={skill.name}
    />
  )
}
