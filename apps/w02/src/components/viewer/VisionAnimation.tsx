import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { visionPrinciples } from '../../data/visionPrinciples'
import { useViewerStore } from '../../store/viewerStore'

/** One clock shared by all animated meshes. UI progress is sampled at 10 Hz. */
export function useVisionAnimationClock() {
  const elapsed = useRef(0)
  const progress = useRef(useViewerStore.getState().animationProgress)
  const totalTime = useRef(0)
  const lastSync = useRef(0)
  const step = useViewerStore((state) => state.currentVisionStep)
  const revision = useViewerStore((state) => state.playbackRevision)

  useEffect(() => {
    const state = useViewerStore.getState()
    elapsed.current = state.animationProgress * (visionPrinciples[state.currentVisionStep]?.duration ?? 5)
    progress.current = state.animationProgress
    totalTime.current = elapsed.current
    lastSync.current = 0
  }, [step, revision])

  useFrame((_, delta) => {
    const state = useViewerStore.getState()
    if (!state.isAnimationPlaying) return
    const duration = visionPrinciples[state.currentVisionStep]?.duration ?? 5
    elapsed.current = Math.min(duration, elapsed.current + Math.min(delta, 0.1))
    totalTime.current = elapsed.current
    progress.current = elapsed.current / duration
    lastSync.current += delta
    if (lastSync.current >= 0.1 || progress.current >= 1) {
      state.setProgress(progress.current)
      lastSync.current = 0
    }
    if (progress.current >= 1) state.finishStep()
  })

  return { progress, elapsed: totalTime }
}
