import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../../store/viewerStore'
import { getLensThickness, getPupilRadius } from '../../utils/optics'
import type { StructureId, Vector3Tuple } from '../../types'
import { useStructureInteraction } from './SelectionHighlight'
import { MACULA_POSITION, NERVE_POINTS } from '../../data/eyeLandmarks'

const SEGMENTS = 80
const NO_PICKING = () => undefined

// X is the optical axis; retaining phi ∈ [π, 2π] removes the front Z half.
function sphereShell(radius: number, cutaway: boolean, thetaStart = 0.57, thetaEnd = Math.PI, xScale = 1, xOffset = 0) {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const rows = 56
  const columns = cutaway ? SEGMENTS / 2 : SEGMENTS
  for (let row = 0; row <= rows; row += 1) {
    const theta = thetaStart + (thetaEnd - thetaStart) * row / rows
    for (let column = 0; column <= columns; column += 1) {
      const phi = (cutaway ? Math.PI : 0) + (cutaway ? Math.PI : Math.PI * 2) * column / columns
      const x = -Math.cos(theta)
      const y = Math.sin(theta) * Math.cos(phi)
      const z = Math.sin(theta) * Math.sin(phi)
      positions.push(xOffset + radius * x * xScale, radius * y, radius * z)
      const normal = new THREE.Vector3(x / xScale, y, z).normalize()
      normals.push(normal.x, normal.y, normal.z)
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column
        const b = a + columns + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

function shellRim(inner: number, outer: number, thetaStart: number) {
  const points: number[] = []
  const indices: number[] = []
  for (const sign of [1, -1]) {
    const offset = points.length / 3
    for (let i = 0; i <= 96; i += 1) {
      const theta = thetaStart + (Math.PI - thetaStart) * i / 96
      for (const radius of [inner, outer]) points.push(-radius * Math.cos(theta), sign * radius * Math.sin(theta), 0.012)
      if (i < 96) {
        const a = offset + i * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function irisGeometry(inner: number, outer: number, cutaway: boolean, textured = false) {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const columns = 120
  const rings = textured ? 8 : 1
  const color = new THREE.Color()
  for (let ring = 0; ring <= rings; ring += 1) {
    const fraction = ring / rings
    const radius = inner + (outer - inner) * fraction
    for (let i = 0; i <= columns; i += 1) {
      const phi = (cutaway ? Math.PI : 0) + (cutaway ? Math.PI : Math.PI * 2) * i / columns
      positions.push(0, radius * Math.cos(phi), radius * Math.sin(phi))
      const streak = Math.sin(phi * 51) * 0.08 + Math.sin(phi * 97 + fraction * 5) * 0.035
      color.setHSL(0.49 + streak * 0.25, 0.37, 0.30 + streak + Math.sin(fraction * Math.PI) * 0.17)
      colors.push(color.r, color.g, color.b)
      if (ring < rings && i < columns) {
        const a = ring * (columns + 1) + i
        const b = a + columns + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function useDisposableGeometry<T extends THREE.BufferGeometry>(factory: () => T, deps: React.DependencyList) {
  // A geometry is built once per mode; frame loops only modify transforms/attributes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(factory, deps)
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Shell({ id, radius, color, cutaway, thetaStart = 0.57, opacity = 1 }: {
  id: StructureId; radius: number; color: string; cutaway: boolean; thetaStart?: number; opacity?: number
}) {
  const geometry = useDisposableGeometry(() => sphereShell(radius, cutaway, thetaStart), [radius, cutaway, thetaStart])
  const appearance = useStructureInteraction(id)
  return <mesh geometry={geometry} name={appearance.name} {...appearance.handlers}>
    <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.43} transparent={opacity < 1}
      opacity={opacity} depthWrite={opacity === 1} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
  </mesh>
}

function CutRim({ id, inner, outer, start, color }: { id: StructureId; inner: number; outer: number; start: number; color: string }) {
  const geometry = useDisposableGeometry(() => shellRim(inner, outer, start), [inner, outer, start])
  const appearance = useStructureInteraction(id)
  return <mesh geometry={geometry} {...appearance.handlers}>
    <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.6} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
  </mesh>
}

function Cornea({ cutaway }: { cutaway: boolean }) {
  const geometry = useDisposableGeometry(() => sphereShell(0.89, cutaway, 0, Math.PI / 2, 0.505, -1.34), [cutaway])
  const appearance = useStructureInteraction('cornea')
  function raycastEdge(this: THREE.Mesh, raycaster: THREE.Raycaster, intersections: THREE.Intersection[]) {
    const hits: THREE.Intersection[] = []
    THREE.Mesh.prototype.raycast.call(this, raycaster, hits)
    for (const hit of hits) {
      const point = this.worldToLocal(hit.point.clone())
      // Let clicks through the clear central cap reach the visible iris/aperture.
      if (Math.hypot(point.y, point.z) > 0.76) intersections.push(hit)
    }
  }
  return <mesh geometry={geometry} name={appearance.name} {...appearance.handlers} raycast={cutaway ? undefined : raycastEdge} renderOrder={3}>
    <meshPhysicalMaterial color="#b7e4e8" transparent opacity={0.23} roughness={0.1} metalness={0.02} clearcoat={1}
      depthWrite={false} side={THREE.DoubleSide} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
  </mesh>
}

function Iris({ cutaway }: { cutaway: boolean }) {
  const iris = useRef<THREE.Mesh>(null)
  const pupil = useRef<THREE.Mesh>(null)
  const hit = useRef<THREE.Mesh>(null)
  const currentRadius = useRef(getPupilRadius(useViewerStore.getState().ambientMode))
  const geometry = useDisposableGeometry(() => irisGeometry(0.23, 0.83, cutaway, true), [cutaway])
  const edge = useDisposableGeometry(() => irisGeometry(0.97, 1.04, cutaway), [cutaway])
  const irisAppearance = useStructureInteraction('iris')
  const pupilAppearance = useStructureInteraction('pupil')
  useFrame((_, delta) => {
    const target = getPupilRadius(useViewerStore.getState().ambientMode)
    currentRadius.current = THREE.MathUtils.damp(currentRadius.current, target, 7, delta)
    const inner = currentRadius.current
    const position = geometry.attributes.position
    for (let ring = 0; ring <= 8; ring += 1) {
      const radius = inner + (0.83 - inner) * ring / 8
      for (let i = 0; i <= 120; i += 1) {
        const phi = (cutaway ? Math.PI : 0) + (cutaway ? Math.PI : Math.PI * 2) * i / 120
        const index = ring * 121 + i
        position.setXYZ(index, 0, radius * Math.cos(phi), radius * Math.sin(phi))
      }
    }
    position.needsUpdate = true
    if (pupil.current) pupil.current.scale.set(1, inner, inner)
    if (hit.current) hit.current.scale.set(inner, inner, 1)
  })
  return <group position={[-1.3, 0, 0]}>
    <mesh ref={iris} name={irisAppearance.name} geometry={geometry} {...irisAppearance.handlers}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.42} emissive={irisAppearance.emissive} emissiveIntensity={irisAppearance.emissiveIntensity} />
    </mesh>
    <mesh ref={pupil} position={[-0.004, 0, 0]} geometry={edge} name={pupilAppearance.name} {...pupilAppearance.handlers}>
      <meshStandardMaterial color={pupilAppearance.selected ? '#e3be66' : '#284c54'} side={THREE.DoubleSide} roughness={0.45} emissive={pupilAppearance.emissive} emissiveIntensity={pupilAppearance.emissiveIntensity} />
    </mesh>
    {/* Invisible hit target: the pupil remains a real opening, with no opaque disc. */}
    <mesh ref={hit} rotation={[0, Math.PI / 2, 0]} position={[-0.01, 0, 0]} {...pupilAppearance.handlers}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
  </group>
}

function Lens({ cutaway }: { cutaway: boolean }) {
  const lens = useRef<THREE.Mesh>(null)
  const appearance = useStructureInteraction('lens')
  useFrame((_, delta) => {
    if (lens.current) lens.current.scale.x = THREE.MathUtils.damp(lens.current.scale.x, getLensThickness(useViewerStore.getState().focusMode), 5, delta)
  })
  return <group position={[-1.03, 0, 0]}>
    <mesh ref={lens} name={appearance.name} scale={[0.18, 0.62, 0.62]} {...appearance.handlers} renderOrder={2}>
      <sphereGeometry args={[1, 56, 40]} />
      <meshPhysicalMaterial color="#c5e3e9" roughness={0.08} transparent opacity={cutaway ? 0.35 : 0.15} clearcoat={1} metalness={0.03}
        side={THREE.DoubleSide} depthWrite={false} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
    </mesh>
    <mesh rotation={[0, Math.PI / 2, 0]} raycast={NO_PICKING}>
      <torusGeometry args={[0.62, 0.01, 8, 72]} />
      <meshStandardMaterial color="#79b7c4" transparent opacity={0.8} />
    </mesh>
  </group>
}

function CiliaryBody({ cutaway }: { cutaway: boolean }) {
  const appearance = useStructureInteraction('ciliary-body')
  const geometry = useDisposableGeometry(() => {
    const points = Array.from({ length: 81 }, (_, i) => {
      const phi = (cutaway ? Math.PI : 0) + (cutaway ? Math.PI : Math.PI * 2) * i / 80
      return new THREE.Vector3(-0.91, 0.87 * Math.cos(phi), 0.87 * Math.sin(phi))
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, 0.105, 12, !cutaway)
  }, [cutaway])
  const fibers = useMemo(() => Array.from({ length: cutaway ? 17 : 32 }, (_, i) => {
    const phi = (cutaway ? Math.PI : 0) + (cutaway ? Math.PI : Math.PI * 2) * i / (cutaway ? 16 : 32)
    return [[-0.91, 0.81 * Math.cos(phi), 0.81 * Math.sin(phi)], [-1.03, 0.62 * Math.cos(phi), 0.62 * Math.sin(phi)]] as Vector3Tuple[]
  }), [cutaway])
  return <group>
    <mesh geometry={geometry} name={appearance.name} {...appearance.handlers}>
      <meshStandardMaterial color="#b58785" roughness={0.64} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
    </mesh>
    {fibers.map((points, index) => <Line key={index} points={points} color="#d1c3ac" lineWidth={0.7} raycast={NO_PICKING} />)}
  </group>
}

function Vitreous({ cutaway }: { cutaway: boolean }) {
  const appearance = useStructureInteraction('vitreous')
  const geometry = useDisposableGeometry(() => sphereShell(1.50, cutaway, 0.98), [cutaway])
  return <mesh name={appearance.name} geometry={geometry} {...appearance.handlers} raycast={NO_PICKING} renderOrder={1}>
    <meshPhysicalMaterial color="#bbdde0" transparent opacity={appearance.selected ? 0.24 : 0.07}
      depthWrite={false} side={THREE.DoubleSide} roughness={0.08} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
  </mesh>
}

function OpticNerve() {
  const appearance = useStructureInteraction('optic-nerve')
  const geometry = useDisposableGeometry(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(NERVE_POINTS.map((p) => new THREE.Vector3(...p))), 40, 0.23, 20, false), [])
  const strands = useMemo(() => Array.from({ length: 5 }, (_, index) => NERVE_POINTS.map((p) => [p[0], p[1] + (index - 2) * 0.07, p[2] + 0.205] as Vector3Tuple)), [])
  return <group>
    <mesh name={appearance.name} geometry={geometry} {...appearance.handlers}>
      <meshStandardMaterial color="#dbc59d" roughness={0.68} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
    </mesh>
    {strands.map((points, index) => <Line key={index} points={points} color="#b29b76" transparent opacity={0.42} lineWidth={0.8} raycast={NO_PICKING} />)}
    <mesh position={NERVE_POINTS[3]} rotation={[0, Math.PI / 2 + 0.24, 0]} {...appearance.handlers}>
      <circleGeometry args={[0.225, 32]} />
      <meshStandardMaterial color="#edd5a1" side={THREE.DoubleSide} roughness={0.6} />
    </mesh>
  </group>
}

function Macula() {
  const appearance = useStructureInteraction('macula')
  const position = new THREE.Vector3(...MACULA_POSITION)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize().negate())
  return <group position={position} quaternion={quaternion}>
    <mesh name={appearance.name} {...appearance.handlers}>
      <circleGeometry args={[0.19, 40]} />
      <meshStandardMaterial color="#d8964f" side={THREE.DoubleSide} roughness={0.65} emissive={appearance.emissive} emissiveIntensity={appearance.emissiveIntensity} />
    </mesh>
    <mesh position={[0, 0, 0.003]} {...appearance.handlers}>
      <circleGeometry args={[0.064, 24]} />
      <meshStandardMaterial color="#9b6648" side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  </group>
}

function BloodVessels({ cutaway }: { cutaway: boolean }) {
  const paths = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const phi = index / 12 * Math.PI * 2
    return Array.from({ length: 24 }, (_, i) => {
      const theta = 0.59 + i / 23 * (0.37 + (index % 3) * 0.15)
      const twist = phi + Math.sin(i * 0.38 + index) * 0.04
      return [-1.657 * Math.cos(theta), 1.657 * Math.sin(theta) * Math.cos(twist), 1.657 * Math.sin(theta) * Math.sin(twist)] as Vector3Tuple
    })
  }), [])
  if (cutaway) return null
  return <group>{paths.map((points, index) => <Line key={index} points={points} color="#c58e8e" transparent opacity={0.32} lineWidth={0.65} raycast={NO_PICKING} />)}</group>
}

export default function EyeModel({ retinaOnly = false, forceCutaway = false }: { retinaOnly?: boolean; forceCutaway?: boolean }) {
  const cutaway = useViewerStore((state) => state.viewMode === 'cutaway') || forceCutaway
  return <group>
    {!retinaOnly && <Shell id="sclera" radius={1.65} color="#eeece3" cutaway={cutaway} />}
    <Shell id="retina" radius={1.592} color={cutaway ? '#bc8980' : '#303137'} cutaway={cutaway} thetaStart={0.86} />
    <Shell id="retina" radius={1.56} color={cutaway ? '#db9d88' : '#222b30'} cutaway={cutaway} thetaStart={0.86} />
    {cutaway && <>
      {!retinaOnly && <CutRim id="sclera" inner={1.60} outer={1.65} start={0.57} color="#f5f0e8" />}
      <CutRim id="retina" inner={1.575} outer={1.60} start={0.86} color="#b4786d" />
      <CutRim id="retina" inner={1.54} outer={1.575} start={0.86} color="#eeb59a" />
    </>}
    {!retinaOnly && <>
      <Vitreous cutaway={cutaway} />
      <CiliaryBody cutaway={cutaway} />
      <Lens cutaway={cutaway} />
      <Iris cutaway={cutaway} />
      <Cornea cutaway={cutaway} />
      <OpticNerve />
      <Macula />
      <BloodVessels cutaway={cutaway} />
    </>}
  </group>
}
