import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { SubagentPreset } from './presets'

export function PresetEditor({
  preset,
  onCancel,
  onSave
}: {
  preset: SubagentPreset | null
  onCancel: () => void
  onSave: (preset: SubagentPreset) => void
}) {
  const [name, setName] = useState(preset?.name ?? '')
  const [character, setCharacter] = useState(preset?.character ?? '')
  const [task, setTask] = useState('')

  return (
    <form
      className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
      onSubmit={event => {
        event.preventDefault()
        const trimmedName = name.trim()
        const trimmedCharacter = character.trim()

        if (!trimmedName || !trimmedCharacter) {
          return
        }
        const now = new Date().toISOString()
        onSave({
          id: preset?.id ?? `custom-${Date.now()}`,
          name: trimmedName,
          character: trimmedCharacter,
          skills: preset?.skills ?? [],
          created_at: preset?.created_at ?? now,
          updated_at: now
        })
      }}
    >
      <label className="grid gap-1 text-xs font-medium">
        Name
        <Input aria-label="Preset name" onChange={event => setName(event.target.value)} value={name} />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Character
        <textarea
          aria-label="Character instructions"
          className="min-h-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={event => setCharacter(event.target.value)}
          value={character}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Task to prepare (optional)
        <Input aria-label="Task to prepare" onChange={event => setTask(event.target.value)} value={task} />
      </label>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button size="sm" type="submit">
          Save preset
        </Button>
      </div>
    </form>
  )
}
