import { useEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { photoreceptorCells, photoreceptorRegions } from '../../data/photoreceptors'
import { getPhotoreceptorDetailLabels } from '../../data/photoreceptorAnnotations'
import { buildPhotoreceptorDistribution, getPhotoreceptorResponse } from '../../utils/photoreceptors'
import type { PhotoreceptorKind } from '../../utils/photoreceptors'
import { useViewerStore } from '../../store/viewerStore'
import type { PhotoreceptorRegion, Vector3Tuple } from '../../types'

const NO_PICKING = () => undefined
const REGION_IDS: PhotoreceptorRegion[] = ['fovea', 'peripheral', 'optic-disc']
const REGION_COLORS: Record<PhotoreceptorRegion, string> = { fovea: '#d49a3f', peripheral: '#598fb0', 'optic-disc': '#8b78a8' }

function DistributionPoints({ kind, positions }: { kind: PhotoreceptorKind; positions: Vector3Tuple[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const material = useRef<THREE.MeshStandardMaterial>(null)
  const response = useRef(0.6)
  const color = useMemo(() => new THREE.Color(photoreceptorCells[kind].color), [kind])
  const selection = useViewerStore((state) => state.selectedPhotoreceptor)
  useEffect(() => {
    if (!mesh.current) return
    const transform = new THREE.Object3D()
    positions.forEach((position, index) => {
      transform.position.set(...position)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [positions])
  useFrame((_, delta) => {
    if (!material.current) return
    const target = getPhotoreceptorResponse(useViewerStore.getState().photoreceptorLight)[kind]
    response.current = THREE.MathUtils.damp(response.current, target, 6, delta)
    material.current.color.copy(color).multiplyScalar(0.5 + 0.5 * response.current)
    material.current.emissiveIntensity = response.current * 0.24
  })
  return <instancedMesh ref={mesh} args={[undefined, undefined, positions.length]} visible={selection === 'both' || selection === kind} raycast={NO_PICKING}>
    <sphereGeometry args={[kind === 'cone' ? 0.02 : 0.013, 8, 6]} />
    <meshStandardMaterial ref={material} color={color} emissive={color} roughness={0.6} />
  </instancedMesh>
}

function DistributionRegion({ id }: { id: PhotoreceptorRegion }) {
  const { gl } = useThree()
  useEffect(() => () => { gl.domElement.style.cursor = 'grab' }, [gl])
  const selected = useViewerStore((state) => state.photoreceptorRegion === id)
  const showAnnotations = useViewerStore((state) => state.showAnnotations)
  const region = photoreceptorRegions[id]
  const transform = useMemo(() => {
    const position = new THREE.Vector3(...region.position)
    const inward = position.clone().normalize().negate()
    return { position: position.clone().addScaledVector(inward, 0.023), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward) }
  }, [region])
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); useViewerStore.getState().setPhotoreceptorRegion(id) }
  return <group>
    <group position={transform.position} quaternion={transform.quaternion}>
      <mesh onClick={click} onDoubleClick={(event) => { click(event); useViewerStore.getState().setPhotoreceptorView('detail') }}
        onPointerOver={(event) => { event.stopPropagation(); gl.domElement.style.cursor = 'pointer' }} onPointerOut={() => { gl.domElement.style.cursor = 'grab' }}>
        <circleGeometry args={[id === 'optic-disc' ? 0.125 : 0.11, 40]} />
        <meshBasicMaterial color={REGION_COLORS[id]} transparent opacity={selected ? 0.35 : 0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh raycast={NO_PICKING}>
        <torusGeometry args={[id === 'optic-disc' ? 0.133 : 0.118, selected ? 0.012 : 0.006, 8, 48]} />
        <meshBasicMaterial color={REGION_COLORS[id]} depthTest={false} />
      </mesh>
    </group>
    {showAnnotations && <Line points={[region.position, region.labelPosition]} color={REGION_COLORS[id]} transparent opacity={selected ? 0.9 : 0.5} lineWidth={selected ? 1.5 : 0.8} raycast={NO_PICKING} />}
  </group>
}

function Cell({ kind, x, slim = false }: { kind: PhotoreceptorKind; x: number; slim?: boolean }) {
  const { gl } = useThree()
  useEffect(() => () => { gl.domElement.style.cursor = 'grab' }, [gl])
  const materials = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const response = useRef(0.6)
  const color = useMemo(() => new THREE.Color(photoreceptorCells[kind].color), [kind])
  const rod = kind === 'rod'
  const outerHeight = rod ? 1.12 : slim ? 1.26 : 0.85
  const outerBottom = 0.92
  const outerRadius = rod ? 0.10 : slim ? 0.085 : 0.18
  const tipRadius = rod ? 0.10 : 0.035
  const innerRadius = rod ? 0.125 : slim ? 0.1 : 0.22
  const bind = (index: number) => (material: THREE.MeshStandardMaterial | null) => { materials.current[index] = material }
  useFrame((_, delta) => {
    const target = getPhotoreceptorResponse(useViewerStore.getState().photoreceptorLight)[kind]
    response.current = THREE.MathUtils.damp(response.current, target, 6, delta)
    materials.current.forEach((material, index) => {
      if (!material) return
      material.color.copy(color).multiplyScalar(0.48 + response.current * 0.52)
      material.emissiveIntensity = response.current * (index === 0 ? 0.34 : 0.10)
    })
  })
  return <group position={[x, 0, 0]} onClick={(event) => { event.stopPropagation(); useViewerStore.getState().selectPhotoreceptor(kind) }}
    onPointerOver={(event) => { event.stopPropagation(); gl.domElement.style.cursor = 'pointer' }} onPointerOut={() => { gl.domElement.style.cursor = 'grab' }}>
    {/* Outer segment tips point toward the RPE, away from the vitreous. */}
    <mesh position={[0, outerBottom + outerHeight / 2, 0]}>
      <cylinderGeometry args={[tipRadius, outerRadius, outerHeight, 24]} />
      <meshStandardMaterial ref={bind(0)} color={color} emissive={color} roughness={0.42} />
    </mesh>
    {Array.from({ length: 14 }, (_, i) => {
      const fraction = (i + 0.6) / 15
      const radius = outerRadius + (tipRadius - outerRadius) * fraction
      return <mesh key={i} position={[0, outerBottom + outerHeight * fraction, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NO_PICKING}>
        <torusGeometry args={[radius + 0.002, 0.005, 4, 20]} />
        <meshStandardMaterial color={rod ? '#3c6c8a' : '#a26c33'} roughness={0.72} />
      </mesh>
    })}
    <mesh position={[0, 0.86, 0]}>
      <cylinderGeometry args={[0.037, 0.037, 0.13, 12]} />
      <meshStandardMaterial ref={bind(1)} color={color} emissive={color} />
    </mesh>
    <mesh position={[0, 0.51, 0]} scale={[innerRadius, 0.34, innerRadius]}>
      <sphereGeometry args={[1, 24, 20]} />
      <meshStandardMaterial ref={bind(2)} color={color} emissive={color} roughness={0.52} />
    </mesh>
    <mesh position={[0, 0.06, 0]}>
      <cylinderGeometry args={[slim ? 0.04 : 0.055, slim ? 0.04 : 0.055, 0.30, 12]} />
      <meshStandardMaterial ref={bind(3)} color={color} emissive={color} />
    </mesh>
    <mesh position={[0, -0.28, 0]} scale={[slim ? 0.105 : rod ? 0.145 : 0.18, 0.29, slim ? 0.105 : 0.145]}>
      <sphereGeometry args={[1, 24, 20]} />
      <meshStandardMaterial ref={bind(4)} color={color} emissive={color} roughness={0.5} />
    </mesh>
    <mesh position={[0, -0.28, 0.115]} scale={[slim ? 0.055 : 0.08, 0.14, 0.025]} raycast={NO_PICKING}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial color={rod ? '#315772' : '#8f5d2b'} roughness={0.58} />
    </mesh>
    <mesh position={[0, -0.77, 0]}>
      <cylinderGeometry args={[0.035, 0.035, 0.47, 12]} />
      <meshStandardMaterial ref={bind(5)} color={color} emissive={color} />
    </mesh>
    <mesh position={[0, -1.04, 0]} scale={[rod || slim ? 0.12 : 0.22, 0.09, rod || slim ? 0.12 : 0.2]}>
      <sphereGeometry args={[1, 20, 16]} />
      <meshStandardMaterial ref={bind(6)} color={color} emissive={color} roughness={0.52} />
    </mesh>
  </group>
}

function DirectionArrow({ x, bottom, top, color, downward = false }: { x: number; bottom: number; top: number; color: string; downward?: boolean }) {
  return <group>
    <Line points={[[x, bottom, 0.15], [x, top, 0.15]]} color={color} lineWidth={2.5} raycast={NO_PICKING} />
    <mesh position={[x, downward ? bottom : top, 0.15]} rotation={[0, 0, downward ? Math.PI : 0]} raycast={NO_PICKING}>
      <coneGeometry args={[0.08, 0.2, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  </group>
}

function NeuralNetwork({ cellPositions, fovea }: { cellPositions: number[]; fovea: boolean }) {
  if (fovea) return null
  // Generic network only: no claim of a complete rod circuit or exact synapse wiring.
  return <group>
    <mesh position={[0, -1.53, -0.05]} raycast={NO_PICKING}>
      <boxGeometry args={[4.15, 0.09, 1.15]} />
      <meshStandardMaterial color="#b8b4c9" transparent opacity={0.21} depthWrite={false} roughness={0.75} />
    </mesh>
    {cellPositions.map((x, i) => <group key={i}>
      <Line points={[[x, -1.12, 0], [x, -1.34, -0.16], [x + 0.13, -1.55, -0.22]]} color="#9584b0" lineWidth={1.5} raycast={NO_PICKING} />
      <mesh position={[x + 0.13, -1.55, -0.22]} raycast={NO_PICKING}>
        <sphereGeometry args={[0.105, 16, 12]} />
        <meshStandardMaterial color="#a193b9" roughness={0.65} />
      </mesh>
      <Line points={[[x + 0.13, -1.55, -0.22], [x + 0.30, -1.78, -0.35], [1.75, -2.01, -0.4]]} color="#ac9bbc" lineWidth={0.9} transparent opacity={0.7} raycast={NO_PICKING} />
    </group>)}
  </group>
}

function OpticDiscDetail() {
  const strands = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const phi = i / 9 * Math.PI * 2
    const x = Math.cos(phi) * 0.47
    const z = Math.sin(phi) * 0.47
    return [[x * 2.7, -0.55, z], [x, 0.5, z], [x * 0.8, 1.2, z * 0.8], [x * 0.7, 2.2, z * 0.7]] as Vector3Tuple[]
  }), [])
  return <group>
    <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_PICKING}>
      <ringGeometry args={[0.78, 2.05, 64]} />
      <meshStandardMaterial color="#d6a087" roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_PICKING}>
      <torusGeometry args={[0.8, 0.045, 12, 64]} />
      <meshStandardMaterial color="#b28e9e" roughness={0.7} />
    </mesh>
    {strands.map((points, i) => <Line key={i} points={points} color="#b59a72" lineWidth={6} raycast={NO_PICKING} />)}
  </group>
}

function PhotoreceptorDetail() {
  const region = useViewerStore((state) => state.photoreceptorRegion)
  const selection = useViewerStore((state) => state.selectedPhotoreceptor)
  const showAnnotations = useViewerStore((state) => state.showAnnotations)
  const labels = getPhotoreceptorDetailLabels(region, selection)
  const fovea = region === 'fovea'
  const rods = fovea || selection === 'cone' ? [] : selection === 'rod' ? [-0.75, 0, 0.75] : [-1.36, -0.82, -0.28]
  const cones = selection === 'rod' ? [] : fovea ? [-1.2, -0.6, 0, 0.6, 1.2] : selection === 'cone' ? [-0.42, 0.42] : [0.62, 1.46]
  return <group>
    {region === 'optic-disc' ? <OpticDiscDetail /> : <>
      <mesh position={[0, 2.28, -0.04]} raycast={NO_PICKING}>
        <boxGeometry args={[4.15, 0.16, 1.15]} />
        <meshStandardMaterial color="#8d6d65" roughness={0.8} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-1.85 + i * 0.335, 2.38, 0.05]} raycast={NO_PICKING}>
        <boxGeometry args={[0.3, 0.025, 0.98]} />
        <meshStandardMaterial color={i % 2 ? '#a38978' : '#947466'} roughness={0.9} />
      </mesh>)}
      {rods.map((x) => <Cell key={`rod-${x}`} kind="rod" x={x} />)}
      {cones.map((x) => <Cell key={`cone-${x}`} kind="cone" x={x} slim={fovea} />)}
      <NeuralNetwork cellPositions={[...rods, ...cones]} fovea={fovea} />
      <DirectionArrow x={2.65} bottom={-1.58} top={1.91} color="#d7b35d" />
      {!fovea && <DirectionArrow x={2.18} bottom={-1.87} top={-0.65} color="#9c81b5" downward />}
    </>}
    {showAnnotations && labels.filter((label) => label.target).map((label) => <Line key={label.id} points={[label.target!, label.position]} color="#83929b" lineWidth={0.8} transparent opacity={0.65} raycast={NO_PICKING} />)}
  </group>
}

export default function PhotoreceptorSystem() {
  const view = useViewerStore((state) => state.photoreceptorView)
  const samples = useMemo(() => buildPhotoreceptorDistribution(), [])
  const positions = useMemo(() => ({
    cone: samples.filter((sample) => sample.kind === 'cone').map((sample) => sample.position),
    rod: samples.filter((sample) => sample.kind === 'rod').map((sample) => sample.position),
  }), [samples])
  return view === 'detail' ? <PhotoreceptorDetail /> : <group>
    <DistributionPoints kind="cone" positions={positions.cone} />
    <DistributionPoints kind="rod" positions={positions.rod} />
    {REGION_IDS.map((id) => <DistributionRegion key={id} id={id} />)}
  </group>
}
