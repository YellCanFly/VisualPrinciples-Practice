import type { AmbientMode, FocusMode, Vector3Tuple } from '../types'

/** Schematic optical coordinates; the object icon is deliberately not to distance scale. */
export const OPTICAL_LANDMARKS = {
  corneaX: -1.72,
  pupilX: -1.3,
  lensX: -1.03,
  retinaX: 1.55,
  rayZ: 0.08,
} as const

export interface OpticalRay {
  id: string
  sourceSign: 1 | -1
  color: string
  points: Vector3Tuple[]
}

export function getPupilRadius(mode: AmbientMode): number {
  return mode === 'bright' ? 0.23 : 0.38
}

export function getLensThickness(mode: FocusMode): number {
  return mode === 'near' ? 0.25 : 0.18
}

/**
 * Representative rays, not a clinical ray tracer. Each object endpoint has its
 * own bundle, bent once at the cornea and again at the lens; the iris is an
 * aperture only. Close-object bundles subtend a larger angle at the cornea.
 */
export function buildOpticalRays({ focusMode, ambientMode = 'bright' }: {
  focusMode: FocusMode
  ambientMode?: AmbientMode
}): OpticalRay[] {
  const near = focusMode === 'near'
  const sourceX = near ? -2.9 : -3.65
  const count = ambientMode === 'dim' ? 5 : 3
  const sourceHeight = 0.64
  const imageHeight = near ? 0.27 : 0.21
  const { corneaX, pupilX, lensX, retinaX, rayZ } = OPTICAL_LANDMARKS
  const pupilFraction = (pupilX - corneaX) / (lensX - corneaX)
  const rays: OpticalRay[] = []

  for (const sign of [1, -1] as const) {
    for (let i = 0; i < count; i += 1) {
      const fraction = i / (count - 1)
      const corneaHeight = near ? fraction * 0.56 : 0.14 + fraction * 0.28
      const lensHeight = near ? 0.09 - fraction * 0.18 : 0.16 - fraction * 0.2
      const pupilHeight = corneaHeight + (lensHeight - corneaHeight) * pupilFraction
      rays.push({
        id: `${sign > 0 ? 'upper' : 'lower'}-${i}`,
        sourceSign: sign,
        color: sign > 0 ? '#eda850' : '#54bcca',
        points: [
          [sourceX, sign * sourceHeight, rayZ],
          [corneaX, sign * corneaHeight, rayZ],
          [pupilX, sign * pupilHeight, rayZ],
          [lensX, sign * lensHeight, rayZ],
          [retinaX, -sign * imageHeight, rayZ],
        ],
      })
    }
  }
  return rays
}

export function polylineLength(points: readonly Vector3Tuple[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2])
  }
  return total
}

/** Samples a piecewise straight path without smoothing away the refraction. */
export function samplePolyline(points: readonly Vector3Tuple[], progress: number): Vector3Tuple {
  if (points.length === 0) return [0, 0, 0]
  if (points.length === 1) return [...points[0]]
  let distance = Math.max(0, Math.min(1, progress)) * polylineLength(points)
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1]
    const end = points[i]
    const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2])
    if (distance <= length || i === points.length - 1) {
      const fraction = length === 0 ? 0 : Math.min(1, distance / length)
      return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction, start[2] + (end[2] - start[2]) * fraction]
    }
    distance -= length
  }
  return [...points[points.length - 1]]
}
