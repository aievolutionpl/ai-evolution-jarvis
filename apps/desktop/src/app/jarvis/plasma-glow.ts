import type { PlasmaPalette, PlasmaSurface } from './plasma'

/** Two broad Canvas 2D light passes keep the network legible above the core. */
export function drawPlasmaGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  energy: number,
  palette: PlasmaPalette,
  surface: PlasmaSurface
): void {
  const light = surface === 'light'
  const reach = radius * (1.38 + energy * 0.18)
  const aura = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, reach)
  aura.addColorStop(0, `rgba(${palette.highlight}, 0)`)
  aura.addColorStop(0.42, `rgba(${palette.front}, ${light ? 0.035 : 0.075 + energy * 0.05})`)
  aura.addColorStop(0.72, `rgba(${palette.rim}, ${light ? 0.05 : 0.11 + energy * 0.07})`)
  aura.addColorStop(1, `rgba(${palette.back}, 0)`)
  ctx.fillStyle = aura
  ctx.beginPath()
  ctx.arc(cx, cy, reach, 0, Math.PI * 2)
  ctx.fill()

  const coreReach = radius * (0.8 + energy * 0.3)
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreReach)
  const scale = light ? 0.35 : 1
  core.addColorStop(0, `rgba(${palette.core}, ${(0.26 + energy * 0.3) * scale})`)
  core.addColorStop(0.22, `rgba(${palette.highlight}, ${(0.17 + energy * 0.18) * scale})`)
  core.addColorStop(0.55, `rgba(${palette.front}, ${(0.08 + energy * 0.1) * scale})`)
  core.addColorStop(1, `rgba(${palette.back}, 0)`)
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(cx, cy, coreReach, 0, Math.PI * 2)
  ctx.fill()
}
