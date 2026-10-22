import { create } from 'zustand'
import { visionPrinciples } from '../data/visionPrinciples'
import type { AmbientMode, ExplorationMode, FocusMode, PhotoreceptorLight, PhotoreceptorRegion, PhotoreceptorSelection, PhotoreceptorView, StructureId, ViewMode } from '../types'

export interface ViewerStore {
  explorationMode: ExplorationMode
  photoreceptorView: PhotoreceptorView
  photoreceptorRegion: PhotoreceptorRegion
  selectedPhotoreceptor: PhotoreceptorSelection
  photoreceptorLight: PhotoreceptorLight
  isolateRetina: boolean
  visionViewBeforePhotoreceptors: ViewMode
  enterPhotoreceptors: () => void
  exitPhotoreceptors: () => void
  setPhotoreceptorView: (view: PhotoreceptorView) => void
  setPhotoreceptorRegion: (region: PhotoreceptorRegion) => void
  selectPhotoreceptor: (selection: PhotoreceptorSelection) => void
  setPhotoreceptorLight: (light: PhotoreceptorLight) => void
  setIsolateRetina: (isolate: boolean) => void
  selectedStructure: StructureId | null
  hoveredStructure: StructureId | null
  currentVisionStep: number
  viewMode: ViewMode
  showAnnotations: boolean
  showLightRays: boolean
  isAnimationPlaying: boolean
  focusMode: FocusMode
  ambientMode: AmbientMode
  cameraRevision: number
  playbackRevision: number
  animationProgress: number
  autoAdvance: boolean
  selectStructure: (id: StructureId | null) => void
  setHover: (id: StructureId | null) => void
  setStep: (step: number) => void
  setViewMode: (mode: ViewMode) => void
  toggleAnnotations: () => void
  toggleRays: () => void
  setFocusMode: (mode: FocusMode) => void
  setAmbientMode: (mode: AmbientMode) => void
  togglePlayback: () => void
  replay: () => void
  nextStep: () => void
  previousStep: () => void
  resetCamera: () => void
  setProgress: (progress: number) => void
  setAutoAdvance: (enabled: boolean) => void
  finishStep: () => void
}

const internalStructures = new Set<StructureId>([
  'lens',
  'vitreous',
  'retina',
  'macula',
  'ciliary-body',
])

const clampStep = (step: number) =>
  Math.min(visionPrinciples.length - 1, Math.max(0, Number.isFinite(step) ? Math.trunc(step) : 0))

export const useViewerStore = create<ViewerStore>((set, get) => ({
  explorationMode: 'vision',
  photoreceptorView: 'distribution',
  photoreceptorRegion: 'peripheral',
  selectedPhotoreceptor: 'both',
  photoreceptorLight: 'bright',
  isolateRetina: false,
  visionViewBeforePhotoreceptors: 'cutaway',
  enterPhotoreceptors: () => set((state) => ({
    explorationMode: 'photoreceptors',
    visionViewBeforePhotoreceptors: state.explorationMode === 'vision' ? state.viewMode : state.visionViewBeforePhotoreceptors,
    viewMode: 'cutaway',
    selectedStructure: null,
    hoveredStructure: null,
    isAnimationPlaying: false,
    cameraRevision: state.cameraRevision + 1,
  })),
  exitPhotoreceptors: () => set((state) => ({
    explorationMode: 'vision',
    viewMode: state.visionViewBeforePhotoreceptors,
    hoveredStructure: null,
    cameraRevision: state.cameraRevision + 1,
  })),
  setPhotoreceptorView: (view) => set((state) => ({ photoreceptorView: view, cameraRevision: state.cameraRevision + 1 })),
  setPhotoreceptorRegion: (region) => set((state) => ({ photoreceptorRegion: region, cameraRevision: state.cameraRevision + 1 })),
  selectPhotoreceptor: (selection) => set({ selectedPhotoreceptor: selection }),
  setPhotoreceptorLight: (light) => set({ photoreceptorLight: light }),
  setIsolateRetina: (isolate) => set({ isolateRetina: isolate }),
  selectedStructure: null,
  hoveredStructure: null,
  currentVisionStep: 0,
  viewMode: 'cutaway',
  showAnnotations: true,
  showLightRays: true,
  isAnimationPlaying: false,
  focusMode: 'far',
  ambientMode: 'bright',
  cameraRevision: 0,
  playbackRevision: 0,
  animationProgress: 0,
  autoAdvance: false,

  selectStructure: (id) => set((state) => ({
    explorationMode: 'vision',
    selectedStructure: id,
    hoveredStructure: null,
    isAnimationPlaying: false,
    viewMode: id && internalStructures.has(id) ? 'cutaway' : state.explorationMode === 'photoreceptors' ? state.visionViewBeforePhotoreceptors : state.viewMode,
    cameraRevision: state.cameraRevision + 1,
  })),

  setHover: (id) => {
    if (get().hoveredStructure !== id) set({ hoveredStructure: id })
  },

  setStep: (step) => set((state) => ({
    explorationMode: 'vision',
    currentVisionStep: clampStep(step),
    selectedStructure: null,
    hoveredStructure: null,
    viewMode: 'cutaway',
    showLightRays: true,
    isAnimationPlaying: true,
    animationProgress: 0,
    playbackRevision: state.playbackRevision + 1,
    cameraRevision: state.cameraRevision + 1,
  })),

  setViewMode: (mode) => set((state) => ({
    explorationMode: 'vision',
    viewMode: mode,
    hoveredStructure: null,
    cameraRevision: state.cameraRevision + 1,
  })),
  toggleAnnotations: () => set((state) => ({ showAnnotations: !state.showAnnotations })),
  toggleRays: () => set((state) => ({ showLightRays: !state.showLightRays })),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setAmbientMode: (mode) => set({ ambientMode: mode }),

  togglePlayback: () => {
    const state = get()
    if (state.isAnimationPlaying) {
      set({ isAnimationPlaying: false })
    } else if (state.animationProgress >= 1) {
      get().replay()
    } else {
      set({
        explorationMode: 'vision',
        selectedStructure: null,
        hoveredStructure: null,
        viewMode: 'cutaway',
        isAnimationPlaying: true,
        showLightRays: true,
        cameraRevision: state.cameraRevision + (state.selectedStructure || state.viewMode === 'full' || state.explorationMode === 'photoreceptors' ? 1 : 0),
      })
    }
  },

  replay: () => set((state) => ({
    explorationMode: 'vision',
    selectedStructure: null,
    hoveredStructure: null,
    viewMode: 'cutaway',
    showLightRays: true,
    isAnimationPlaying: true,
    animationProgress: 0,
    playbackRevision: state.playbackRevision + 1,
    cameraRevision: state.cameraRevision + 1,
  })),

  nextStep: () => get().setStep(get().currentVisionStep + 1),
  previousStep: () => get().setStep(get().currentVisionStep - 1),
  resetCamera: () => set((state) => ({ cameraRevision: state.cameraRevision + 1 })),

  // 调用方按低频采样同步进度；每帧动画时间与位置保存在 Three.js ref 中。
  setProgress: (value) => {
    const progress = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
    if (get().animationProgress !== progress) set({ animationProgress: progress })
  },
  setAutoAdvance: (enabled) => set({ autoAdvance: enabled }),

  finishStep: () => {
    const state = get()
    if (state.autoAdvance && state.currentVisionStep < visionPrinciples.length - 1) {
      get().setStep(state.currentVisionStep + 1)
    } else {
      set({ animationProgress: 1, isAnimationPlaying: false })
    }
  },
}))
