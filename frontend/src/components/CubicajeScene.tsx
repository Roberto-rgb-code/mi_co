import { useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Edges, Line } from '@react-three/drei';
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
    camera.lookAt(cx, cy * 0.85, cz);
    if ('updateProjectionMatrix' in camera) {
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [preset, cx, cy, cz, scale, camera]);

  return (
    <OrbitControls
      target={[cx, cy * 0.85, cz]}
      minDistance={scale * 0.35}
      maxDistance={scale * 5}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

/** Cabina simplificada (estilo dashboard logístico). */
function TruckCab({ ancho, alto }: { ancho: number; alto: number }) {
  const cabL = Math.min(1.8, ancho * 0.85);
  const cabH = alto * 0.75;
  const cabW = ancho * 0.92;
  const x = -cabL * 0.55;

  return (
    <group>
      <mesh position={[x, cabH / 2, ancho / 2]}>
        <boxGeometry args={[cabL, cabH, cabW]} />
        <meshStandardMaterial color="#2c2f33" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[x + cabL * 0.15, cabH * 0.55, ancho / 2 + cabW * 0.42]}>
        <boxGeometry args={[cabL * 0.35, cabH * 0.45, 0.04]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.55} />
      </mesh>
      {[-0.35, 0.35].map((off) => (
        <mesh key={off} rotation={[Math.PI / 2, 0, 0]} position={[x + cabL * 0.2, 0.18, ancho / 2 + off * cabW]}>
          <cylinderGeometry args={[0.18, 0.18, 0.12, 16]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}
    </group>
  );
}

/** Caja de carga semitransparente con rejilla interior (inspirado en 3D-bin-packing / CLOA). */
function TrailerCargo({
  largo,
  ancho,
  alto,
}: {
  largo: number;
  ancho: number;
  alto: number;
}) {
  const gridStep = 0.5;
  const gridLinesX: [number, number, number][] = [];
  for (let x = 0; x <= largo; x += gridStep) {
    gridLinesX.push([x, 0.002, 0], [x, 0.002, ancho]);
  }
  for (let z = 0; z <= ancho; z += gridStep) {
    gridLinesX.push([0, 0.002, z], [largo, 0.002, z]);
  }

  const wallMat = (
    <meshStandardMaterial color="#e5e7eb" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
  );

  return (
    <group>
      {/* Piso */}
      <mesh position={[largo / 2, 0, ancho / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial color="#f9fafb" />
      </mesh>

      {/* Pared lateral visible (corte tipo XPO) */}
      <mesh position={[largo / 2, alto / 2, ancho]} rotation={[0, 0, 0]}>
        <planeGeometry args={[largo, alto]} />
        {wallMat}
        <Edges color="#9ca3af" />
      </mesh>

      {/* Pared trasera */}
      <mesh position={[largo, alto / 2, ancho / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ancho, alto]} />
        {wallMat}
      </mesh>

      {/* Techo tenue */}
      <mesh position={[largo / 2, alto, ancho / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial color="#d1d5db" transparent opacity={0.08} depthWrite={false} />
      </mesh>

      {/* Contorno caja */}
      <mesh position={[largo / 2, alto / 2, ancho / 2]}>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshStandardMaterial visible={false} />
        <Edges color="#6b7280" linewidth={1} />
      </mesh>

      {gridLinesX.map((pts, i) => (
        <Line key={i} points={pts} color="#d1d5db" lineWidth={0.5} />
      ))}
    </group>
  );
}

function BultoMesh({
  bulto,
  dimmed,
  highlighted,
}: {
  bulto: BultoColocado;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const cx = bulto.x + bulto.largo / 2;
  const cy = bulto.y + bulto.alto / 2;
  const cz = bulto.z + bulto.ancho / 2;
  const opacity = dimmed ? 0.15 : highlighted ? 1 : 0.92;

  return (
    <mesh position={[cx, cy, cz]} castShadow receiveShadow>
      <boxGeometry args={[bulto.largo, bulto.alto, bulto.ancho]} />
      <meshStandardMaterial
        color={highlighted ? '#ff6b6b' : bulto.color}
        roughness={0.4}
        metalness={0.08}
        transparent={dimmed || highlighted}
        opacity={opacity}
      />
      <Edges color={highlighted ? '#fff' : '#374151'} linewidth={highlighted ? 2 : 1} />
    </mesh>
  );
}

function SceneContent({
  result,
  preset,
  filaFilter,
  highlightedId,
}: {
  result: CubicajeResult;
  preset: CameraPreset;
  filaFilter: number | null;
  highlightedId: string | null;
}) {
  const { contenedor, bultos } = result;
  const maxDim = Math.max(contenedor.largo, contenedor.ancho, contenedor.alto, 1);

  return (
    <>
      <color attach="background" args={['#f5f6f8']} />
      <fog attach="fog" args={['#f5f6f8', maxDim * 3, maxDim * 8]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[maxDim * 2, maxDim * 2, maxDim]} intensity={1.1} castShadow />
      <directionalLight position={[-maxDim, maxDim * 0.5, -maxDim * 0.5]} intensity={0.35} />
      <CameraRig preset={preset} contenedor={contenedor} />
      <TruckCab ancho={contenedor.ancho} alto={contenedor.alto} />
      <TrailerCargo {...contenedor} />
      {bultos.map((b) => (
        <BultoMesh
          key={b.id}
          bulto={b}
          dimmed={filaFilter != null && b.fila !== filaFilter}
          highlighted={highlightedId === b.id}
        />
      ))}
    </>
  );
}

export function CubicajeScene({
  result,
  preset,
  filaFilter = null,
  highlightedId = null,
}: {
  result: CubicajeResult;
  preset: CameraPreset;
  filaFilter?: number | null;
  highlightedId?: string | null;
}) {
  const maxDim = useMemo(
    () => Math.max(result.contenedor.largo, result.contenedor.ancho, result.contenedor.alto, 1),
    [result],
  );

  return (
    <Canvas
      shadows
      camera={{ fov: 42, near: 0.01, far: maxDim * 25, position: [maxDim, maxDim, maxDim] }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent
        result={result}
        preset={preset}
        filaFilter={filaFilter}
        highlightedId={highlightedId}
      />
    </Canvas>
  );
}
