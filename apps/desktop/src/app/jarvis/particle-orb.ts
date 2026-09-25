/**
 * The Jarvis orb's particle network: a hollow sphere of drifting particles,
 * wired together by faint links between the ones that drift close enough,
 * with bright "electrons" travelling along those links while Jarvis works.
 *
 * Every state has its own body language — at rest the cloud is wide and slow,
 * listening draws it in, working packs it tight with dense links and
 * electrons, speaking lets the measured voice level breathe it outward — and a
 * change of state gives the cloud a short tumble so the change is felt, not
 * just recoloured.
 *
 * Canvas 2D only (docs/product/AI_EVOLUTION_JARVIS_DESIGN.md §6: no WebGL on
 * the light path). The simulation is framerate-independent: `step(dt)` eases
 * with `1 - exp(-k·dt)`, so a 144 Hz panel and a throttled 30 Hz one settle
 * the same way.
 */

import type { PlasmaPalette, PlasmaSurface, PlasmaTone } from './plasma'

export interface OrbMotionTargets {
  /** Shell radius as a fraction of the orb radius. */
  radius: number
  /** Wander strength. */
  speed: number
  /** Particle opacity. */
  brightness: number
  /** How visible the proximity links are, 0…1. */
  links: number
  /** Whether electrons are sent along links, 0…1. */
  electrons: number
  /** How far the shell departs from a sphere (fraction of the radius). */
  morph: number
  /** How fast the shape's waves travel over the surface. */
  wave: number
}

// Each state moves differently: at rest the shell barely breathes, listening
// lets the voice push it out of round, speaking sends quick waves across it,
// working folds it into slow rotating lobes, an error withdraws it.
const TARGETS: Record<PlasmaTone, OrbMotionTargets> = {
  idle: { brightness: 0.6, electrons: 0, links: 0.42, morph: 0.05, radius: 1, speed: 0.25, wave: 0.3 },
  listening: { brightness: 0.72, electrons: 0, links: 0.55, morph: 0.07, radius: 0.84, speed: 0.36, wave: 0.6 },
  working: { brightness: 0.78, electrons: 1, links: 1, morph: 0.16, radius: 0.64, speed: 0.6, wave: 0.8 },
  speaking: { brightness: 0.82, electrons: 0, links: 0.85, morph: 0.09, radius: 0.74, speed: 0.26, wave: 1.1 },
  approval: { brightness: 0.72, electrons: 0.4, links: 0.65, morph: 0.08, radius: 0.8, speed: 0.2, wave: 0.5 },
  success: { brightness: 0.66, electrons: 0, links: 0.45, morph: 0.05, radius: 0.92, speed: 0.22, wave: 0.3 },
  // Withdrawn and slow: unmistakably not "about to answer".
  error: { brightness: 0.42, electrons: 0, links: 0.18, morph: 0.03, radius: 0.7, speed: 0.1, wave: 0.2 }
}

/** How much a measured voice level adds to the shape's departure from round. */
const VOICE_MORPH: Partial<Record<PlasmaTone, number>> = { listening: 0.3, speaking: 0.35 }

export function orbMotionTargets(tone: PlasmaTone): OrbMotionTargets {
  return TARGETS[tone]
}

export interface ParticleOrbInput {
  tone: PlasmaTone
  /** Measured audio level, 0…1. */
  level: number
  /** Backend task pressure, 0…1. */
  signal: number
}

interface Electron {
  from: number
  to: number
  progress: number
  speed: number
}

/** Deterministic PRNG, so every orb starts from the same cloud. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_ELECTRONS = 4
const ELECTRON_INTERVAL_S = 0.9
/** Link distance in orb-radius units. */
const LINK_DISTANCE = 0.3
/** Camera distance for the perspective projection, in orb-radius units. */
const CAMERA = 3.4
const ALPHA_BUCKETS = 5

function ease(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

export class ParticleOrb {
  readonly count: number
  readonly positions: Float32Array
  private readonly velocities: Float32Array
  private readonly phases: Float32Array
  /** Each particle's depth inside the shell, 0.9…1: a shell with some body, thin enough to show its shape. */
  private readonly depths: Float32Array
  private readonly projected: Float32Array
  private readonly random: () => number
  /** Every `stride`-th particle takes part in links: O(n²) stays bounded. */
  private readonly stride: number

  private time = 0
  /** Accumulated wave phase: integrating the speed keeps a speed change smooth. */
  private phase = 0
  private tone: PlasmaTone = 'idle'
  private current: OrbMotionTargets = { ...TARGETS.idle }
  private level = 0
  private yaw = 0
  private spinX = 0
  private spinZ = 0
  private tumble = 0
  private lastElectron = 0
  private readonly electrons: Electron[] = []
  private links: number[] = []

  constructor(count = 420, seed = 0x0a1e7) {
    this.count = count
    this.random = mulberry32(seed)
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.phases = new Float32Array(count)
    this.depths = new Float32Array(count)
    this.projected = new Float32Array(count * 3)
    this.stride = Math.max(1, Math.round(count / 240))

    for (let index = 0; index < count; index += 1) {
      const z = this.random() * 2 - 1
      const angle = this.random() * Math.PI * 2
      const ring = Math.sqrt(1 - z * z)
      const r = 0.62 + this.random() * 0.4
      const i3 = index * 3
      this.positions[i3] = ring * Math.cos(angle) * r
      this.positions[i3 + 1] = z * r
      this.positions[i3 + 2] = ring * Math.sin(angle) * r
      this.phases[index] = this.random() * 1000
      this.depths[index] = 0.9 + this.random() * 0.1
    }
  }

  /** The eased motion values, for tests and for callers that tint around the orb. */
  get motion(): Readonly<OrbMotionTargets> {
    return this.current
  }

  get electronCount(): number {
    return this.electrons.length
  }

  step(dtSeconds: number, { level, signal, tone }: ParticleOrbInput): void {
    // A long gap (tab hidden, debugger) must not fling the cloud apart.
    const dt = Math.min(Math.max(dtSeconds, 0), 0.05)

    if (dt === 0) {
      return
    }

    this.time += dt
    const t = this.time

    if (tone !== this.tone) {
      this.tone = tone
      this.tumble = 1
    }

    const target = TARGETS[tone]
    // Task pressure tightens and quickens the cloud a little on top of its state.
    const pressure = Math.min(1, Math.max(0, signal))

    // A raw meter flickers; the cloud should breathe.
    this.level = ease(this.level, Math.min(1, Math.max(0, level)), 10, dt)

    this.current = {
      brightness: ease(this.current.brightness, target.brightness, 1.2, dt),
      electrons: ease(this.current.electrons, target.electrons, 1.2, dt),
      links: ease(this.current.links, Math.min(1, target.links + pressure * 0.2), 1.2, dt),
      // Shape follows the voice quickly but not instantly: it flows, never jumps.
      morph: ease(this.current.morph, target.morph + (VOICE_MORPH[tone] ?? 0) * this.level, 4, dt),
      radius: ease(this.current.radius, target.radius * (1 - pressure * 0.08), 1.2, dt),
      speed: ease(this.current.speed, target.speed + pressure * 0.2, 1.2, dt),
      wave: ease(this.current.wave, target.wave, 1.5, dt)
    }

    this.phase += dt * this.current.wave

    this.tumble *= Math.exp(-1.1 * dt)
    this.yaw += dt * (0.1 + this.current.speed * 0.35 + this.tumble * 1.4)
    this.spinX += dt * this.tumble * 0.9 * Math.sin(t * 1.7)
    this.spinZ += dt * this.tumble * 0.5 * Math.cos(t * 1.3)

    const { morph, radius, speed } = this.current
    const audio = this.level
    const speaking = tone === 'speaking'
    // Near-critical damping for the shell spring below: the cloud settles into
    // each new shape without wobbling past it.
    const damping = Math.exp(-5 * dt)
    const p = this.positions
    const v = this.velocities
    const w = this.phase
    // Three wave axes that drift slowly, so the lobes wander over the surface.
    const a1 = [Math.cos(t * 0.13), Math.sin(t * 0.13), 0.3]
    const a2 = [0.4, Math.cos(t * 0.11 + 2), Math.sin(t * 0.11 + 2)]
    const a3 = [Math.sin(t * 0.09 + 4), 0.2, Math.cos(t * 0.09 + 4)]

    for (let index = 0; index < this.count; index += 1) {
      const i3 = index * 3
      const phase = this.phases[index]
      const x = p[i3]
      const y = p[i3 + 1]
      const z = p[i3 + 2]
      const wander = 0.25 * speed * dt

      v[i3] += Math.sin(t * 0.5 + phase + y * 1.6) * wander
      v[i3 + 1] += Math.cos(t * 0.6 + phase * 1.3 + z * 1.6) * wander
      v[i3 + 2] += Math.sin(t * 0.55 + phase * 0.7 + x * 1.6) * wander

      const distance = Math.hypot(x, y, z) || 0.001
      const nx = x / distance
      const ny = y / distance
      const nz = z / distance

      // The shell's radius in this particle's direction: a sphere pushed in and
      // out by three travelling waves.
      // Low frequencies only: a soft, liquid silhouette rather than a rock.
      const shape =
        0.6 * Math.sin(1.4 * (nx * a1[0] + ny * a1[1] + nz * a1[2]) * Math.PI + w * 2.4) +
        0.3 * Math.sin(2.2 * (nx * a2[0] + ny * a2[1] + nz * a2[2]) * Math.PI - w * 3.1 + 1.7) +
        0.1 * Math.sin(3 * (nx * a3[0] + ny * a3[1] + nz * a3[2]) * Math.PI + w * 1.7 + 4.1)

      const shell = radius * (1 + morph * shape) * this.depths[index]
      // A spring onto the shell, so the whole cloud takes the new shape together.
      let radial = (shell - distance) * 10

      radial += audio * 0.6

      if (speaking && audio > 0.05) {
        radial += Math.sin(t * 8 + phase) * audio * 0.8
      }

      v[i3] += nx * radial * dt
      v[i3 + 1] += ny * radial * dt
      v[i3 + 2] += nz * radial * dt

      v[i3] *= damping
      v[i3 + 1] *= damping
      v[i3 + 2] *= damping

      p[i3] = x + v[i3] * dt
      p[i3 + 1] = y + v[i3 + 1] * dt
      p[i3 + 2] = z + v[i3 + 2] * dt
    }

    this.updateLinks()
    this.updateElectrons(dt)
  }

  private updateLinks(): void {
    const p = this.positions
    const max = LINK_DISTANCE * (1 + this.level * 0.45)
    const maxSq = max * max
    const links: number[] = []

    if (this.current.links > 0.02) {
      for (let i = 0; i < this.count; i += this.stride) {
        const i3 = i * 3

        for (let j = i + this.stride; j < this.count; j += this.stride) {
          const j3 = j * 3
          const dx = p[j3] - p[i3]
          const dy = p[j3 + 1] - p[i3 + 1]
          const dz = p[j3 + 2] - p[i3 + 2]

          if (dx * dx + dy * dy + dz * dz < maxSq) {
            links.push(i, j)
          }
        }
      }
    }

    this.links = links
  }

  private updateElectrons(dt: number): void {
    for (let index = this.electrons.length - 1; index >= 0; index -= 1) {
      const electron = this.electrons[index]
      electron.progress += electron.speed * dt

      if (electron.progress >= 1) {
        this.electrons.splice(index, 1)
      }
    }

    if (
      this.current.electrons > 0.5 &&
      this.links.length > 0 &&
      this.electrons.length < MAX_ELECTRONS &&
      this.time - this.lastElectron > ELECTRON_INTERVAL_S
    ) {
      const pair = Math.floor(this.random() * (this.links.length / 2)) * 2

      this.electrons.push({
        from: this.links[pair],
        progress: 0,
        speed: 0.35 + this.random() * 0.3,
        to: this.links[pair + 1]
      })
      this.lastElectron = this.time
    }
  }

  /**
   * Paint the network centred on `(cx, cy)` with `radius` CSS pixels per orb
   * unit. Assumes an additive (`lighter`) composite for the glow to stack.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    palette: PlasmaPalette,
    surface: PlasmaSurface = 'dark'
  ): void {
    const light = surface === 'light'
    const p = this.positions
    const out = this.projected
    const cosY = Math.cos(this.yaw)
    const sinY = Math.sin(this.yaw)
    const pitch = 0.3 + this.spinX
    const cosP = Math.cos(pitch)
    const sinP = Math.sin(pitch)
    const cosR = Math.cos(this.spinZ)
    const sinR = Math.sin(this.spinZ)

    for (let index = 0; index < this.count; index += 1) {
      const i3 = index * 3
      const x0 = p[i3] * cosY + p[i3 + 2] * sinY
      const z0 = -p[i3] * sinY + p[i3 + 2] * cosY
      const y1 = p[i3 + 1] * cosP - z0 * sinP
      const z1 = p[i3 + 1] * sinP + z0 * cosP
      const x2 = x0 * cosR - y1 * sinR
      const y2 = x0 * sinR + y1 * cosR
      const perspective = CAMERA / (CAMERA - z1)

      out[i3] = cx + x2 * radius * perspective
      out[i3 + 1] = cy + y2 * radius * perspective
      // Depth 0 (far) … 1 (near).
      out[i3 + 2] = Math.min(1, Math.max(0, (z1 + 1.2) / 2.4))
    }

    const { brightness, links } = this.current
    const level = this.level

    // Links, batched into a few alpha buckets: one stroke per bucket.
    if (links > 0.02 && this.links.length > 0) {
      const max = LINK_DISTANCE * (1 + level * 0.45)
      const buckets: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => [])

      for (let k = 0; k < this.links.length; k += 2) {
        const a = this.links[k] * 3
        const b = this.links[k + 1] * 3
        const dx = p[b] - p[a]
        const dy = p[b + 1] - p[a + 1]
        const dz = p[b + 2] - p[a + 2]
        const closeness = 1 - Math.hypot(dx, dy, dz) / max
        const depth = (out[a + 2] + out[b + 2]) / 2
        const strength = Math.max(0, closeness) * (0.35 + depth * 0.65)
        const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(strength * ALPHA_BUCKETS))
        buckets[bucket].push(out[a], out[a + 1], out[b], out[b + 1])
      }

      ctx.lineWidth = 0.7 + level * 0.5

      for (let bucket = 0; bucket < ALPHA_BUCKETS; bucket += 1) {
        const segments = buckets[bucket]

        if (segments.length === 0) {
          continue
        }

        // Ink on paper needs a little more weight than light on black.
        const alpha = ((bucket + 1) / ALPHA_BUCKETS) * links * (0.3 + level * 0.25) * (light ? 1.9 : 1)
        ctx.strokeStyle = `rgba(${palette.front}, ${alpha.toFixed(3)})`
        ctx.beginPath()

        for (let s = 0; s < segments.length; s += 4) {
          ctx.moveTo(segments[s], segments[s + 1])
          ctx.lineTo(segments[s + 2], segments[s + 3])
        }

        ctx.stroke()
      }
    }

    // Particles: far half dim in the back colour, near half bright.
    const dot = Math.max(0.6, radius / 150) * (1 + level * 0.25)

    for (const near of [false, true]) {
      ctx.fillStyle = near
        ? `rgba(${palette.core}, ${Math.min(1, (brightness + level * 0.15) * (light ? 1.35 : 1)).toFixed(3)})`
        : `rgba(${palette.back}, ${(brightness * (light ? 0.75 : 0.55)).toFixed(3)})`
      ctx.beginPath()

      for (let index = 0; index < this.count; index += 1) {
        const i3 = index * 3
        const depth = out[i3 + 2]

        if (depth >= 0.5 !== near) {
          continue
        }

        const size = dot * (0.55 + depth * 0.9)
        ctx.moveTo(out[i3] + size, out[i3 + 1])
        ctx.arc(out[i3], out[i3 + 1], size, 0, Math.PI * 2)
      }

      ctx.fill()
    }

    // Electrons ride their link, so they follow the cloud as it drifts.
    for (const electron of this.electrons) {
      const a = electron.from * 3
      const b = electron.to * 3
      const x = out[a] + (out[b] - out[a]) * electron.progress
      const y = out[a + 1] + (out[b + 1] - out[a + 1]) * electron.progress
      const glow = ctx.createRadialGradient(x, y, 0, x, y, dot * 7)
      glow.addColorStop(0, light ? `rgba(${palette.core}, 0.95)` : 'rgba(255, 255, 255, 0.95)')
      glow.addColorStop(0.3, `rgba(${palette.core}, 0.55)`)
      glow.addColorStop(1, `rgba(${palette.front}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, dot * 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
