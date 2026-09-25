/**
 * The Jarvis Core's plasma layer: a core glow, the particle network
 * (`particle-orb.ts`) and the glassy body that network outlines.
 *
 * Plain Canvas 2D on purpose (docs/product/AI_EVOLUTION_JARVIS_DESIGN.md §6
 * asks for a light path without WebGL). Everything here but the particle
 * network is a pure function of `(time, level, signal, tone)`; the network's
 * state lives in the `ParticleOrb` the caller steps, so a reduced-motion viewer
 * gets one still frame of it instead of a loop.
 */

import type { ParticleOrb } from './particle-orb'
import type { JarvisTaskPhase, JarvisVoiceState } from './types'

export type PlasmaTone = 'approval' | 'error' | 'idle' | 'listening' | 'speaking' | 'success' | 'working'

export interface PlasmaPalette {
  /** Filament colour on the side facing the viewer. */
  front: string
  /** Filament colour on the far side of the sphere. */
  back: string
  /** Bright centre of the core glow. */
  core: string
  /** Rim light on the orb's edge. */
  rim: string
}

const PALETTES: Record<PlasmaTone, PlasmaPalette> = {
  idle: { back: '124, 92, 255', core: '150, 225, 255', front: '0, 183, 255', rim: '92, 200, 255' },
  listening: { back: '124, 92, 255', core: '190, 240, 255', front: '40, 200, 255', rim: '120, 215, 255' },
  speaking: { back: '0, 183, 255', core: '200, 255, 230', front: '41, 230, 140', rim: '90, 240, 190' },
  working: { back: '0, 183, 255', core: '205, 190, 255', front: '150, 120, 255', rim: '150, 140, 255' },
  approval: { back: '124, 92, 255', core: '255, 236, 190', front: '246, 196, 83', rim: '246, 210, 120' },
  success: { back: '0, 183, 255', core: '200, 255, 225', front: '41, 230, 140', rim: '110, 240, 180' },
  error: { back: '124, 92, 255', core: '255, 200, 210', front: '255, 77, 109', rim: '255, 120, 140' }
}

/**
 * One colour story per state. Voice outranks the task, because an open mic or
 * a speaking voice is what the person is paying attention to right now.
 */
export function plasmaTone(voice: JarvisVoiceState, task: JarvisTaskPhase): PlasmaTone {
  if (voice === 'error' || task === 'failed') {
    return 'error'
  }

  if (voice === 'speaking') {
    return 'speaking'
  }

  if (voice === 'listening') {
    return 'listening'
  }

  if (task === 'approval') {
    return 'approval'
  }

  if (task === 'planning' || task === 'running' || task === 'cancelling') {
    return 'working'
  }

  if (task === 'verified') {
    return 'success'
  }

  return 'idle'
}

/** Which background the orb is painted on: light and dark need different light. */
export type PlasmaSurface = 'dark' | 'light'

function deepen(rgb: string, factor: number): string {
  return rgb
    .split(',')
    .map(channel => Math.round(Number(channel) * factor))
    .join(', ')
}

/**
 * On a light surface additive light washes out, so the orb is drawn as ink:
 * the same hues, deepened, with the dark palette's pale core replaced by the
 * deepest tone so the near side still reads as the brightest.
 */
export function plasmaPalette(tone: PlasmaTone, surface: PlasmaSurface = 'dark'): PlasmaPalette {
  const palette = PALETTES[tone]

  if (surface === 'dark') {
    return palette
  }

  return {
    back: deepen(palette.back, 0.85),
    core: deepen(palette.front, 0.55),
    front: deepen(palette.front, 0.75),
    rim: deepen(palette.rim, 0.7)
  }
}

export interface PlasmaFrameInput {
  /** Seconds since the renderer started. */
  time: number
  /** Measured audio level, 0…1. Zero whenever nothing is listening or speaking. */
  level: number
  /** How hard the backend's task phase drives motion, 0…1. */
  signal: number
  tone: PlasmaTone
  /** The particle network, already stepped for this frame. */
  orb: ParticleOrb
  /** The background the orb sits on. */
  surface?: PlasmaSurface
}

/**
 * Paint one frame. `width`/`height` are CSS pixels; the caller has already
 * scaled the context for the device pixel ratio.
 */
export function drawPlasmaFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { level, orb, signal, surface = 'dark', time, tone }: PlasmaFrameInput
): void {
  const palette = plasmaPalette(tone, surface)
  const light = surface === 'light'
  const size = Math.min(width, height)
  const cx = width / 2
  const cy = height / 2
  const radius = size * 0.32
  const energy = Math.min(1, level * 0.85 + signal * 0.45)

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  // Light adds up on a dark surface; on a light one it is painted, like ink.
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Core glow: a bright centre that swells with the measured level.
  // Kept soft so the particle network in front of it stays readable.
  const glowRadius = radius * (0.8 + energy * 0.3)
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
  const glowScale = light ? 0.35 : 1
  glow.addColorStop(0, `rgba(${palette.core}, ${(0.26 + energy * 0.3) * glowScale})`)
  glow.addColorStop(0.4, `rgba(${palette.front}, ${(0.1 + energy * 0.14) * glowScale})`)
  glow.addColorStop(1, `rgba(${palette.back}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()

  // No fixed rim: the silhouette is the particle shell itself, which changes
  // shape as Jarvis listens and speaks; the orb fills it with a glassy body.
  orb.draw(ctx, cx, cy, radius * 0.95, palette, surface, time)

  ctx.restore()
}
