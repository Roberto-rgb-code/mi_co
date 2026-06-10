import { useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { BultoColocado, CameraPreset, CubicajeResult } from '../types/cubicaje';
import { CAMERA_PRESETS } from '../types/cubicaje';

function CameraRig({
  preset,
  contenedor,
}: {
  preset: CameraPreset;
  contenedor: CubicajeResult['contenedor'];
}) {
  const { camera } = useThree();
  const { largo, ancho, alto } = contenedor;
  const cx = largo / 2;
  const cy = alto / 2;
  const cz = ancho / 2;
  const scale = Math.max(largo, ancho, alto, 1);

  useEffect(() => {
    const [px, py, pz] = CAMERA_PRESETS[preset].position;
    camera.position.set(cx + px * scale, cy + py * scale, cz + pz * scale);
    camera.lookAt(cx, cy, cz);
    if ('updateProjectionMatrix' in camera) {
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [preset, cx, cy, cz, scale, camera]);

  return (
    <OrbitControls
      target={[cx, cy, cz]}
      minDistance={scale * 0.4}
      maxDistance={scale * 4}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

function Contenedor({ largo, ancho, alto }: { largo: number; ancho: number; alto: number }) {
  return (
    <group>
      <mesh position={[largo / 2, alto / 2, ancho / 2]}>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshStandardMaterial color="#f3f4f6" transparent opacity={0.12} depthWrite={false} />
        <Edges color="#374151" linewidth={1} />
      </mesh>
      <gridHelper
        args={[Math.max(largo, ancho), Math.ceil(Math.max(largo, ancho)), '#d1d5db', '#e5e7eb']}
        position={[largo / 2, 0.001, ancho / 2]}
      />
    </group>
  );
}

function BultoMesh({ bulto }: { bulto: BultoColocado }) {
  const cx = bulto.x + bulto.largo / 2;
  const cy = bulto.y + bulto.alto / 2;
  const cz = bulto.z + bulto.ancho / 2;

  return (
    <mesh position={[cx, cy, cz]} castShadow receiveShadow>
      <boxGeometry args={[bulto.largo, bulto.alto, bulto.ancho]} />
      <meshStandardMaterial color={bulto.color} roughness={0.45} metalness={0.05} />
      <Edges color="#8b0a1f" />
    </mesh>
  );
}

function SceneContent({
  result,
  preset,
}: {
  result: CubicajeResult;
  preset: CameraPreset;
}) {
  const { contenedor, bultos } = result;
  const maxDim = Math.max(contenedor.largo, contenedor.ancho, contenedor.alto, 1);

  return (
    <>
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[maxDim, maxDim * 1.5, maxDim]} intensity={0.85} castShadow />
      <directionalLight position={[-maxDim, maxDim, -maxDim]} intensity={0.25} />
      <CameraRig preset={preset} contenedor={contenedor} />
      <Contenedor {...contenedor} />
      {bultos.map((b) => (
        <BultoMesh key={b.id} bulto={b} />
      ))}
    </>
  );
}

export function CubicajeScene({
  result,
  preset,
}: {
  result: CubicajeResult;
  preset: CameraPreset;
}) {
  const maxDim = useMemo(
    () => Math.max(result.contenedor.largo, result.contenedor.ancho, result.contenedor.alto, 1),
    [result],
  );

  return (
    <Canvas
      shadows
      camera={{ fov: 45, near: 0.01, far: maxDim * 20, position: [maxDim, maxDim, maxDim] }}
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
    >
      <SceneContent result={result} preset={preset} />
    </Canvas>
  );
}
