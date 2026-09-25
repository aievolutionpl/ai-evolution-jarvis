import { describe, expect, it } from 'vitest'

import { JARVIS_PLAYBOOK, jarvisPlaybookCategories, selectJarvisPlaybook } from './playbook'

describe('selectAgent CzesiekPlaybook', () => {
  it('never offers what the machine has not been allowed to do', () => {
    const chat = selectJarvisPlaybook({ computerMode: 'chat' })
    const assist = selectJarvisPlaybook({ computerMode: 'assist' })
    const operator = selectJarvisPlaybook({ computerMode: 'operator' })

    expect(chat.every(entry => entry.requires === undefined)).toBe(true)
    expect(assist.some(entry => entry.requires === 'workspace')).toBe(true)
    expect(assist.every(entry => entry.requires !== 'desktop-control')).toBe(true)
    expect(operator.some(entry => entry.requires === 'desktop-control')).toBe(true)
  })

  it('offers nothing capability-gated before setup has chosen a mode', () => {
    expect(selectJarvisPlaybook({ computerMode: null }).every(entry => entry.requires === undefined)).toBe(true)
  })

  it('leads with the starter deck on a cold start and stops leading once there is history', () => {
    const cold = selectJarvisPlaybook({ computerMode: 'operator' })
    const warm = selectJarvisPlaybook({ computerMode: 'operator', hasHistory: true })

    expect(cold[0]?.starter).toBe(true)
    expect(warm.map(entry => entry.id)).toEqual(JARVIS_PLAYBOOK.map(entry => entry.id))
  })

  it('drops hidden tips and honours the limit', () => {
    const hidden = selectJarvisPlaybook({ computerMode: 'chat', dismissedIds: ['web.research'] })

    expect(hidden.map(entry => entry.id)).not.toContain('web.research')
    expect(selectJarvisPlaybook({ computerMode: 'chat' }, { limit: 2 })).toHaveLength(2)
  })
})

describe('jarvisPlaybookCategories', () => {
  it('lists each category once, in deck order', () => {
    expect(jarvisPlaybookCategories(selectJarvisPlaybook({ computerMode: 'chat', hasHistory: true }))).toEqual([
      'web',
      'automation',
      'memory',
      'voice'
    ])
  })
})
