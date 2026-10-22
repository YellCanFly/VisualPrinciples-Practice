import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useViewerStore } from '../../store/viewerStore'
import { buildOpticalRays, samplePolyline } from '../../utils/optics'
import type { OpticalRay } from '../../utils/optics'
import type { Vector3Tuple } from '../../types'
import { useVisionAnimationClock } from './VisionAnimation'
import { NEURAL_PATH } from '../../data/eyeLandmarks'

const NO_PICKING = () => undefined
// A polyline curve preserves a visible angular kink at both refracting surfaces.
class PolylineCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly points: Vector3Tuple[]) { super() }
  getPoint(t: number, target = new THREE.Vector3()) {
    const sampled = samplePolyline(this.points, t)
    return target.set(sampled[0], sampled[1], sampled[2])
  }
}

function RayPath({ ray, activePoints }: { ray: OpticalRay; activePoints: Vector3Tuple[] }) {
  const geometries = useMemo(() => ({
    complete: new THREE.TubeGeometry(new PolylineCurve(ray.points), 72, 0.01, 6, false),
    active: new THREE.TubeGeometry(new PolylineCurve(activePoints), 56, 0.012, 6, false),
  }), [ray, activePoints])
  useEffect(() => () => { geometries.complete.dispose(); geometries.active.dispose() }, [geometries])
  return <group>
    <mesh geometry={geometries.complete} raycast={NO_PICKING}>
      <meshBasicMaterial color={ray.color} transparent opacity={0.42} depthWrite={false} />
    </mesh>
    <mesh geometry={geometries.active} raycast={NO_PICKING}>
      <meshBasicMaterial color={ray.color} transparent opacity={0.72} depthWrite={false} />
    </mesh>
  </group>
}

function ObjectArrow({ x, height, inverted = false, opacity = 1 }: { x: number; height: number; inverted?: boolean; opacity?: number }) {
  return <group position={[x, 0, 0.13]}>
    <mesh position={[0, height * 0.25, 0]} raycast={NO_PICKING}>
      <cylinderGeometry args={[0.024, 0.024, height * 0.5, 12]} />
      <meshBasicMaterial color={inverted ? '#54bcca' : '#eda850'} transparent opacity={opacity} depthWrite={false} />
    </mesh>
    <mesh position={[0, -height * 0.25, 0]} raycast={NO_PICKING}>
      <cylinderGeometry args={[0.024, 0.024, height * 0.5, 12]} />
      <meshBasicMaterial color={inverted ? '#eda850' : '#54bcca'} transparent opacity={opacity} depthWrite={false} />
    </mesh>
    <mesh position={[0, (inverted ? -1 : 1) * (height / 2 - 0.03), 0]} rotation={[0, 0, inverted ? Math.PI : 0]} raycast={NO_PICKING}>
      <coneGeometry args={[0.085, 0.17, 3]} />
      <meshBasicMaterial color="#eda850" transparent opacity={opacity} depthWrite={false} />
    </mesh>
    <mesh position={[0, (inverted ? 1 : -1) * height / 2, 0]} raycast={NO_PICKING}>
      <sphereGeometry args={[0.035, 12, 8]} />
      <meshBasicMaterial color="#54bcca" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  </group>
}

export default function LightRaySystem() {
  const mode = useViewerStore((state) => state.focusMode)
  const ambientMode = useViewerStore((state) => state.ambientMode)
  const step = useViewerStore((state) => state.currentVisionStep)
  const visible = useViewerStore((state) => state.showLightRays)
  const dots = useRef<(THREE.Mesh | null)[]>([])
  const pulses = useRef<(THREE.Mesh | null)[]>([])
  const { progress, elapsed } = useVisionAnimationClock()
  const rays = useMemo(() => buildOpticalRays({ focusMode: mode, ambientMode }), [mode, ambientMode])
  const activePaths = useMemo(() => rays.map((ray) => {
    const range = [[0, 2], [0, 3], [1, 4], [2, 5], [0, 5], [0, 5]][step] ?? [0, 5]
    return ray.points.slice(range[0], range[1])
  }), [rays, step])
  const nerveGeometry = useMemo(() => new THREE.TubeGeometry(new PolylineCurve(NEURAL_PATH), 50, 0.011, 6, false), [])
  useEffect(() => () => nerveGeometry.dispose(), [nerveGeometry])

  useFrame(() => {
    for (let i = 0; i < rays.length; i += 1) {
      const dot = dots.current[i]
      if (!dot) continue
      const t = Math.min(1, progress.current * 1.06 + (i % 3) * 0.035)
      const point = samplePolyline(activePaths[i], t)
      dot.position.set(...point)
      dot.visible = step < 5
    }
    for (let i = 0; i < pulses.current.length; i += 1) {
      const pulse = pulses.current[i]
      if (!pulse) continue
      const t = ((elapsed.current * 0.43 + i / 3) % 1)
      pulse.position.set(...samplePolyline(NEURAL_PATH, t))
      const size = 1 + Math.sin(elapsed.current * 5 + i) * 0.17
      pulse.scale.setScalar(size)
      pulse.visible = step === 5
    }
  })

  const sourceX = mode === 'near' ? -2.9 : -3.65
  return <group visible={visible}>
    {rays.map((ray, index) => <group key={ray.id}>
      <RayPath ray={ray} activePoints={activePaths[index]} />
      <mesh ref={(mesh) => { dots.current[index] = mesh }} raycast={NO_PICKING}>
        <sphereGeometry args={[0.027, 12, 8]} />
        <meshBasicMaterial color={ray.color} toneMapped={false} />
      </mesh>
    </group>)}
    <ObjectArrow x={sourceX} height={1.28} />
    <ObjectArrow x={1.55} height={mode === 'near' ? 0.54 : 0.42} inverted opacity={step >= 4 ? 1 : 0.24} />
    <group visible={step === 5}>
      <mesh geometry={nerveGeometry} raycast={NO_PICKING}>
        <meshBasicMaterial color="#b192d1" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      {[0, 1, 2].map((index) => <mesh key={index} ref={(mesh) => { pulses.current[index] = mesh }} raycast={NO_PICKING}>
        <sphereGeometry args={[0.046, 12, 8]} />
        <meshBasicMaterial color="#a784d1" toneMapped={false} />
      </mesh>)}
    </group>
  </group>
}
