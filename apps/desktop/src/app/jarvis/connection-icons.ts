import { Bell, GitBranch, Layers3, Lightbulb, Mail, MessageCircle, Network, NotebookTabs } from '@/lib/icons'

import type { JarvisConnectionId } from './connections-catalog'

type IconComponent = React.ComponentType<{ className?: string }>

/** One face per connection, shared by the onboarding step and the Połączenia page. */
export const CONNECTION_ICONS: Record<JarvisConnectionId, { icon: IconComponent; tile: string }> = {
  email: { icon: Mail, tile: 'bg-sky-400/15 text-sky-300' },
  github: { icon: GitBranch, tile: 'bg-zinc-300/15 text-zinc-200' },
  google: { icon: Layers3, tile: 'bg-emerald-400/15 text-emerald-300' },
  mcp: { icon: Network, tile: 'bg-fuchsia-400/15 text-fuchsia-300' },
  messaging: { icon: MessageCircle, tile: 'bg-cyan-400/15 text-cyan-300' },
  notion: { icon: NotebookTabs, tile: 'bg-stone-300/15 text-stone-200' },
  phone: { icon: Bell, tile: 'bg-amber-400/15 text-amber-300' },
  smartHome: { icon: Lightbulb, tile: 'bg-yellow-400/15 text-yellow-300' }
}
