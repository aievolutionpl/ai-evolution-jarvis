// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SkillInfo } from '@/types/hermes'

import { SkillListItem } from './skill-list-item'

const skill: SkillInfo = {
  category: 'research',
  description: 'Find grounded sources',
  enabled: true,
  name: 'web-research',
  provenance: 'bundled',
  usage: 4
}

describe('SkillListItem', () => {
  it('keeps the backend identity for actions while presenting a readable name and source', () => {
    const onSelect = vi.fn()
    const onToggle = vi.fn()

    render(<SkillListItem active={false} onSelect={onSelect} onToggle={onToggle} skill={skill} usageLabel="×4" />)

    expect(screen.getByText('Web Research')).toBeTruthy()
    expect(screen.getByText('Research')).toBeTruthy()
    expect(screen.getByText('×4')).toBeTruthy()

    fireEvent.click(screen.getByText('Web Research'))
    fireEvent.click(screen.getByRole('switch', { name: 'web-research' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
