import { beforeEach, describe, expect, it } from 'vitest'
import { useViewerStore } from '../src/store/viewerStore'
import { buildPhotoreceptorDistribution, FOVEA_ROD_FREE_ANGLE, getRegionCellKinds, OPTIC_DISC_EMPTY_ANGLE, PHOTORECEPTOR_RADIUS, retinalAngle } from '../src/utils/photoreceptors'
import { photoreceptorRegions } from '../src/data/photoreceptors'

const initial = useViewerStore.getState()
beforeEach(() => useViewerStore.setState(initial, true))

describe('感光细胞的科学分布约束', () => {
  it('鼻侧定义为Z正方向，视盘与中央凹分离且略偏上', () => {
    const fovea = photoreceptorRegions.fovea.position
    const disc = photoreceptorRegions['optic-disc'].position
    expect(disc[1]).toBeGreaterThan(fovea[1])
    expect(disc[2]).toBeGreaterThan(fovea[2])
    expect(retinalAngle(disc, 'fovea')).toBeGreaterThan(OPTIC_DISC_EMPTY_ANGLE + FOVEA_ROD_FREE_ANGLE)
  })

  it('视盘没有感光点，中央凹中心没有视杆，周边保留两类', () => {
    const samples = buildPhotoreceptorDistribution()
    expect(samples.length).toBeGreaterThan(500)
    const kinds = new Set(samples.filter((s) => retinalAngle(s.position, 'fovea') > 0.5).map((s) => s.kind))
    expect(kinds).toEqual(new Set(['cone', 'rod']))
    expect(samples.some((s) => s.kind === 'cone' && retinalAngle(s.position, 'fovea') < FOVEA_ROD_FREE_ANGLE)).toBe(true)
    for (const sample of samples) {
      expect(sample.position.every(Number.isFinite)).toBe(true)
      expect(Math.hypot(...sample.position)).toBeCloseTo(PHOTORECEPTOR_RADIUS, 9)
      expect(sample.position[2]).toBeLessThanOrEqual(0)
      expect(retinalAngle(sample.position, 'optic-disc')).toBeGreaterThanOrEqual(OPTIC_DISC_EMPTY_ANGLE - 1e-10)
      if (sample.kind === 'rod') expect(retinalAngle(sample.position, 'fovea')).toBeGreaterThanOrEqual(FOVEA_ROD_FREE_ANGLE - 1e-10)
    }
    expect(getRegionCellKinds('optic-disc')).toEqual([])
    expect(getRegionCellKinds('fovea')).toEqual(['cone'])
  })
})

describe('整体眼球与细胞探索的状态边界', () => {
  it('进入探索暂停步骤，退出恢复整体视图、进度和显示偏好', () => {
    const store = useViewerStore.getState()
    store.setStep(4)
    store.setProgress(0.43)
    store.setViewMode('full')
    store.toggleRays()
    store.toggleAnnotations()
    store.enterPhotoreceptors()
    expect(useViewerStore.getState()).toMatchObject({ explorationMode: 'photoreceptors', viewMode: 'cutaway', isAnimationPlaying: false, animationProgress: 0.43 })
    store.setPhotoreceptorView('detail')
    store.setPhotoreceptorRegion('fovea')
    store.enterPhotoreceptors() // 重复进入不覆盖保存的完整视图。
    store.exitPhotoreceptors()
    expect(useViewerStore.getState()).toMatchObject({ explorationMode: 'vision', viewMode: 'full', animationProgress: 0.43, currentVisionStep: 4, showLightRays: false, showAnnotations: false, isAnimationPlaying: false })
  })

  it('细胞局部视图中选择原理、结构或重播均恢复原眼球场景', () => {
    const store = useViewerStore.getState()
    store.enterPhotoreceptors()
    store.setPhotoreceptorView('detail')
    store.setStep(5)
    expect(useViewerStore.getState()).toMatchObject({ explorationMode: 'vision', currentVisionStep: 5, isAnimationPlaying: true, showLightRays: true })
    store.enterPhotoreceptors()
    store.selectStructure('lens')
    expect(useViewerStore.getState()).toMatchObject({ explorationMode: 'vision', selectedStructure: 'lens', viewMode: 'cutaway' })
    store.enterPhotoreceptors()
    store.replay()
    expect(useViewerStore.getState()).toMatchObject({ explorationMode: 'vision', isAnimationPlaying: true, animationProgress: 0 })
  })
})
