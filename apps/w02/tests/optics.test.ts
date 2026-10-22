import { describe, expect, it } from 'vitest'
import { buildOpticalRays, getLensThickness, getPupilRadius, OPTICAL_LANDMARKS, samplePolyline } from '../src/utils/optics'
import type { AmbientMode, FocusMode } from '../src/types'

describe('示意光线的基本教学约束', () => {
  for (const focusMode of ['far', 'near'] as FocusMode[]) {
    for (const ambientMode of ['bright', 'dim'] as AmbientMode[]) {
      it(`${focusMode}/${ambientMode} 的光线穿过开口，并在视网膜形成同源倒立缩小像`, () => {
        const rays = buildOpticalRays({ focusMode, ambientMode })
        const pupilRadius = getPupilRadius(ambientMode)
        for (const ray of rays) {
          const [source, cornea, pupil, lens, retina] = ray.points
          expect(ray.points.flat().every(Number.isFinite)).toBe(true)
          expect(source[0]).toBeLessThan(cornea[0])
          expect(cornea[0]).toBeLessThan(pupil[0])
          expect(pupil[0]).toBeLessThan(lens[0])
          expect(lens[0]).toBeLessThan(retina[0])
          expect(Math.hypot(pupil[1], pupil[2])).toBeLessThan(pupilRadius)
          expect(source[1] * retina[1]).toBeLessThan(0)
          expect(Math.abs(retina[1])).toBeLessThan(Math.abs(source[1]))
          expect(retina[0]).toBe(OPTICAL_LANDMARKS.retinaX)
          // 瞳孔只是开口，角膜之后的路径在此不能产生额外折射。
          const beforeSlope = (pupil[1] - cornea[1]) / (pupil[0] - cornea[0])
          const afterSlope = (lens[1] - pupil[1]) / (lens[0] - pupil[0])
          expect(beforeSlope).toBeCloseTo(afterSlope, 8)
        }
        for (const sign of [1, -1]) {
          const bundle = rays.filter((ray) => ray.sourceSign === sign)
          expect(bundle.length).toBeGreaterThanOrEqual(3)
          for (const ray of bundle) {
            expect(ray.points[0]).toEqual(bundle[0].points[0])
            expect(ray.points[4]).toEqual(bundle[0].points[4])
          }
        }
      })
    }
  }

  it('近处入射发散更大、晶状体更凸；较暗环境扩大瞳孔并增加代表性光线', () => {
    const angularSpread = (mode: FocusMode) => {
      const angles = buildOpticalRays({ focusMode: mode }).filter((ray) => ray.sourceSign === 1).map((ray) => {
        const [a, b] = ray.points
        return Math.atan2(b[1] - a[1], b[0] - a[0])
      })
      return Math.max(...angles) - Math.min(...angles)
    }
    expect(angularSpread('near')).toBeGreaterThan(angularSpread('far'))
    expect(getLensThickness('near')).toBeGreaterThan(getLensThickness('far'))
    expect(getPupilRadius('dim')).toBeGreaterThan(getPupilRadius('bright'))
    expect(buildOpticalRays({ focusMode: 'far', ambientMode: 'dim' }).length)
      .toBeGreaterThan(buildOpticalRays({ focusMode: 'far', ambientMode: 'bright' }).length)
  })

  it('动画按路径长度均匀采样，跨折点不穿过眼球内部捷径', () => {
    const points: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 3, 0]]
    expect(samplePolyline(points, 0.25)).toEqual([1, 0, 0])
    expect(samplePolyline(points, 0.5)).toEqual([1, 1, 0])
    expect(samplePolyline(points, -1)).toEqual([0, 0, 0])
    expect(samplePolyline(points, 2)).toEqual([1, 3, 0])
  })
})
