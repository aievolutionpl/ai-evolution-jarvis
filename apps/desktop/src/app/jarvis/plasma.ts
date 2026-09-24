/**
 * The Jarvis Core's plasma layer: energy filaments wrapped around a glass
 * sphere, a drift of surface particles and — on the home hero — a projection
 * platform under the orb.
 *
 * Plain Canvas 2D on purpose (docs/product/AI_EVOLUTION_JARVIS_DESIGN.md §6
 * asks for a light path without WebGL). Geometry and colour are pure functions
 * of `(time, level, signal, tone)`, so the renderer holds no animation state of
 * its own: the same inputs always paint the same frame, and a reduced-motion
 * viewer gets one still frame instead of a loop.
 */

import type { JarvisTaskPhase, JarvisVoiceState } from './types'

export type PlasmaTone = 'approval' | 'error' | 'idle' | 'listening' | 'speaking' | 'success' | 'working'

export interface PlasmaPalette {
  /** Filament colour on the side facing the viewer. */
  front: string
  /** Filament colour on the far side of the sphere. */
  back: string
  /** Bright centre of the core glow. */
  core: string
  /** Rim light and platform rings. */
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

export function plasmaPalette(tone: PlasmaTone): PlasmaPalette {
  return PALETTES[tone]
}

interface Vec3 {
  x: number
  y: number
  z: number
}

interface Filament {
  /** Two orthonormal vectors spanning the filament's plane. */
  u: Vec3
  v: Vec3
  phase: number
  /** Lobe counts of the two displacement waves. */
  k1: number
  k2: number
  speed: number
  width: number
}

interface Particle {
  point: Vec3
  size: number
  twinkle: number
}

/** Deterministic PRNG, so every core draws the same structure. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1

  return { x: v.x / length, y: v.y / length, z: v.z / length }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

function randomUnit(random: () => number): Vec3 {
  const z = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(1 - z * z)

  return { x: radius * Math.cos(angle), y: z, z: radius * Math.sin(angle) }
}

function buildFilaments(count: number, random: () => number): Filament[] {
  return Array.from({ length: count }, () => {
    const normal = randomUnit(random)
    const helper = Math.abs(normal.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
    const u = normalize(cross(normal, helper))

    return {
      k1: 2 + Math.floor(random() * 4),
      k2: 3 + Math.floor(random() * 5),
      phase: random() * Math.PI * 2,
      speed: 0.35 + random() * 0.75,
      u,
      v: cross(normal, u),
      width: 0.6 + random() * 1.3
    }
  })
}

function buildParticles(count: number, random: () => number): Particle[] {
  return Array.from({ length: count }, () => ({
    point: randomUnit(random),
    size: 0.5 + random() * 1.4,
    twinkle: random() * Math.PI * 2
  }))
}

const FILAMENT_COUNT = 16
const PARTICLE_COUNT = 90
const SEGMENTS = 72

export const PLASMA_STRUCTURE = (() => {
  const random = mulberry32(0x0a1e7)

  return {
    filaments: buildFilaments(FILAMENT_COUNT, random),
    particles: buildParticles(PARTICLE_COUNT, random)
  }
})()

function rotate(point: Vec3, yaw: number, pitch: number): Vec3 {
  const cosY = Math.cos(yaw)
  const sinY = Math.sin(yaw)
  const x = point.x * cosY + point.z * sinY
  const z = -point.x * sinY + point.z * cosY
  const cosP = Math.cos(pitch)
  const sinP = Math.sin(pitch)

  return { x, y: point.y * cosP - z * sinP, z: point.y * sinP + z * cosP }
}

export interface PlasmaFrameInput {
  /** Seconds since the renderer started. */
  time: number
  /** Measured audio level, 0…1. Zero whenever nothing is listening or speaking. */
  level: number
  /** How hard the backend's task phase drives motion, 0…1. */
  signal: number
  tone: PlasmaTone
  /** Draw the projection platform under the orb. */
  platform: boolean
}

/**
 * Paint one frame. `width`/`height` are CSS pixels; the caller has already
 * scaled the context for the device pixel ratio.
 */
export function drawPlasmaFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { level, platform, signal, time, tone }: PlasmaFrameInput
): void {
  const palette = plasmaPalette(tone)
  // With a platform the canvas is taller than wide: the orb sits in the top
  // square (matching the glass stage behind it) and the platform below.
  const size = platform ? width : Math.min(width, height)
  const cx = width / 2
  const cy = platform ? width / 2 : height / 2
  const radius = size * 0.32
  const energy = Math.min(1, level * 0.85 + signal * 0.45)
  const yaw = time * (0.18 + signal * 0.35)
  const pitch = 0.32 + Math.sin(time * 0.21) * 0.08

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (platform) {
    drawPlatform(ctx, cx, cy + radius * 1.42, radius, palette, time, energy)
  }

  // Core glow: a bright centre that swells with the measured level.
  const glowRadius = radius * (0.9 + energy * 0.25)
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
  glow.addColorStop(0, `rgba(${palette.core}, ${0.55 + energy * 0.35})`)
  glow.addColorStop(0.35, `rgba(${palette.front}, ${0.22 + energy * 0.2})`)
  glow.addColorStop(1, `rgba(${palette.back}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()

  // Filaments: each a displaced great circle, split into its far half (dim,
  // violet) and near half (bright) so the sphere reads as a volume.
  const amplitude = 0.05 + energy * 0.16

  for (const filament of PLASMA_STRUCTURE.filaments) {
    const back = new Path2DLike()
    const front = new Path2DLike()
    const wobble = time * filament.speed

    for (let index = 0; index <= SEGMENTS; index += 1) {
      const theta = (index / SEGMENTS) * Math.PI * 2

      const displacement =
        1 +
        amplitude * Math.sin(filament.k1 * theta + wobble + filament.phase) +
        amplitude * 0.6 * Math.sin(filament.k2 * theta - wobble * 1.3)

      const r = radius * 0.92 * displacement
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)

      const point = rotate(
        {
          x: (filament.u.x * cos + filament.v.x * sin) * r,
          y: (filament.u.y * cos + filament.v.y * sin) * r,
          z: (filament.u.z * cos + filament.v.z * sin) * r
        },
        yaw,
        pitch
      )

      ;(point.z >= 0 ? front : back).push(cx + point.x, cy + point.y)
      ;(point.z >= 0 ? back : front).breakPath()
    }

    ctx.lineWidth = filament.width * (0.8 + energy * 0.7)
    ctx.strokeStyle = `rgba(${palette.back}, ${0.16 + energy * 0.12})`
    back.stroke(ctx)
    ctx.strokeStyle = `rgba(${palette.front}, ${0.34 + energy * 0.34})`
    front.stroke(ctx)
  }

  // Particles ride the same rotation; near ones are brighter and larger.
  for (const particle of PLASMA_STRUCTURE.particles) {
    const point = rotate(particle.point, yaw * 0.7, pitch)
    const depth = (point.z + 1) / 2
    const shell = radius * (1.02 + 0.12 * Math.sin(time * 0.6 + particle.twinkle) + energy * 0.12)
    const alpha = (0.12 + depth * 0.6) * (0.6 + 0.4 * Math.sin(time * 1.7 + particle.twinkle))

    ctx.fillStyle = `rgba(${depth > 0.5 ? palette.core : palette.back}, ${Math.max(0, alpha)})`
    ctx.beginPath()
    ctx.arc(cx + point.x * shell, cy + point.y * shell, particle.size * (0.6 + depth), 0, Math.PI * 2)
    ctx.fill()
  }

  // Rim light: the sphere's silhouette, brighter on the lit top-left.
  const rim = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
  rim.addColorStop(0, `rgba(${palette.rim}, ${0.75 + energy * 0.2})`)
  rim.addColorStop(0.55, `rgba(${palette.front}, 0.28)`)
  rim.addColorStop(1, `rgba(${palette.back}, 0.5)`)
  ctx.strokeStyle = rim
  ctx.lineWidth = 1.6 + energy * 1.6
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  palette: PlasmaPalette,
  time: number,
  energy: number
): void {
  // The beam that "projects" the orb, fading upward.
  const beam = ctx.createLinearGradient(cx, cy, cx, cy - radius * 2.4)
  beam.addColorStop(0, `rgba(${palette.rim}, ${0.14 + energy * 0.12})`)
  beam.addColorStop(1, `rgba(${palette.rim}, 0)`)
  ctx.fillStyle = beam
  ctx.beginPath()
  ctx.moveTo(cx - radius * 0.7, cy)
  ctx.lineTo(cx - radius * 0.25, cy - radius * 2.4)
  ctx.lineTo(cx + radius * 0.25, cy - radius * 2.4)
  ctx.lineTo(cx + radius * 0.7, cy)
  ctx.closePath()
  ctx.fill()

  for (let ring = 0; ring < 4; ring += 1) {
    const spread = 0.55 + ring * 0.32 + (Math.sin(time * 0.9 - ring * 0.7) + 1) * 0.03
    ctx.strokeStyle = `rgba(${palette.rim}, ${(0.5 - ring * 0.1) * (0.7 + energy * 0.5)})`
    ctx.lineWidth = ring === 0 ? 2 : 1
    ctx.beginPath()
    ctx.ellipse(cx, cy, radius * spread * 1.4, radius * spread * 0.22, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/**
 * A polyline that can be broken into runs, so one filament's near and far
 * halves stroke separately without a hundred tiny `stroke()` calls.
 */
class Path2DLike {
  private runs: number[][] = []
  private current: number[] | null = null

  push(x: number, y: number): void {
    if (!this.current) {
      this.current = []
      this.runs.push(this.current)
    }

    this.current.push(x, y)
  }

  breakPath(): void {
    this.current = null
  }

  stroke(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath()

    for (const run of this.runs) {
      if (run.length < 4) {
        continue
      }

      ctx.moveTo(run[0], run[1])

      for (let index = 2; index < run.length; index += 2) {
        ctx.lineTo(run[index], run[index + 1])
      }
    }

    ctx.stroke()
  }
}
