import { beforeEach, describe, expect, it } from 'vitest'
import { useViewerStore } from '../src/store/viewerStore'
import { visionPrinciples } from '../src/data/visionPrinciples'
import { eyeStructures, structureById } from '../src/data/eyeStructures'
import { annotations } from '../src/data/annotations'

const initialState = useViewerStore.getState()

beforeEach(() => useViewerStore.setState(initialState, true))

describe('教学状态的交互一致性', () => {
  it('选择教学步骤时恢复剖视、光线、相机与新的播放时间', () => {
    const store = useViewerStore.getState()
    store.setViewMode('full')
    store.toggleRays()
    store.selectStructure('sclera')
    store.setProgress(0.7)
    const revision = useViewerStore.getState().cameraRevision
    useViewerStore.getState().setStep(3)
    expect(useViewerStore.getState()).toMatchObject({
      currentVisionStep: 3, viewMode: 'cutaway', selectedStructure: null,
      showLightRays: true, isAnimationPlaying: true, animationProgress: 0,
    })
    expect(useViewerStore.getState().cameraRevision).toBeGreaterThan(revision)
  })

  it('暂停保留进度，重播从头开始', () => {
    useViewerStore.getState().setStep(1)
    useViewerStore.getState().setProgress(0.43)
    useViewerStore.getState().togglePlayback()
    expect(useViewerStore.getState().isAnimationPlaying).toBe(false)
    expect(useViewerStore.getState().animationProgress).toBe(0.43)
    useViewerStore.getState().replay()
    expect(useViewerStore.getState()).toMatchObject({ isAnimationPlaying: true, animationProgress: 0 })
  })

  it('连续播放抵达末尾会停止，手动步骤越界不能破坏数据访问', () => {
    useViewerStore.getState().setAutoAdvance(true)
    useViewerStore.getState().setStep(4)
    useViewerStore.getState().finishStep()
    expect(useViewerStore.getState().currentVisionStep).toBe(5)
    useViewerStore.getState().finishStep()
    expect(useViewerStore.getState()).toMatchObject({ currentVisionStep: 5, isAnimationPlaying: false, animationProgress: 1 })
    useViewerStore.getState().setStep(999)
    expect(useViewerStore.getState().currentVisionStep).toBe(visionPrinciples.length - 1)
    useViewerStore.getState().setStep(-10)
    expect(useViewerStore.getState().currentVisionStep).toBe(0)
  })

  it('在完整视图选择内部晶状体会露出剖面并停止步骤动画', () => {
    useViewerStore.getState().setStep(0)
    useViewerStore.getState().setViewMode('full')
    useViewerStore.getState().selectStructure('lens')
    expect(useViewerStore.getState()).toMatchObject({ selectedStructure: 'lens', viewMode: 'cutaway', isAnimationPlaying: false })
  })
})

describe('内容与模型关联完整性', () => {
  it('十个结构、六个步骤和全部标注均引用存在的结构', () => {
    expect(eyeStructures).toHaveLength(10)
    expect(visionPrinciples).toHaveLength(6)
    expect(new Set(eyeStructures.map((s) => s.id)).size).toBe(10)
    for (const step of visionPrinciples) {
      expect(step.duration).toBeGreaterThan(0)
      for (const id of step.relatedStructures) expect(structureById[id]).toBeDefined()
    }
    for (const annotation of annotations) {
      expect(structureById[annotation.structureId]).toBeDefined()
      expect(annotation.position.every(Number.isFinite)).toBe(true)
      expect(annotation.labelPosition.every(Number.isFinite)).toBe(true)
    }
  })
})
