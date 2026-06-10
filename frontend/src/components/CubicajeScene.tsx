import { Suspense, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { BultoNoColocado, CameraPreset, CubicajeResult } from '../types/cubicaje';
import { CAMERA_PRESETS } from '../types/cubicaje';
import { IsuzuTruck, CargoBulto, UnplacedStack } from './IsuzuTruckModel';

export interface CubicajeSceneProps {
  contenedor: CubicajeResult['contenedor'];
  modeloLabel?: string;
  bultos?: CubicajeResult['bultos'];
  noColocados?: BultoNoColocado[];
  tarimaDims?: { largo: number; ancho: number; alto: number };
  preset: CameraPreset;
  filaFilter?: number | null;
  highlightedId?: string | null;
}

function CameraRig({
  preset,
  contenedor,
}: {
  preset: CameraPreset;
  contenedor: CubicajeResult['contenedor'];
}) {
  const { camera } = useThree();
  const { largo, ancho, alto } = contenedor;
  const cx = largo / 2 - 0.5;
  const cy = alto / 2;
  const cz = ancho / 2;
  const scale = Math.max(largo + 2, ancho, alto, 4);

  useEffect(() => {
    const [px, py, pz] = CAMERA_PRESETS[preset].position;
    camera.position.set(cx + px * scale, cy + py * scale, cz + pz * scale);
    camera.lookAt(cx, cy * 0.75, cz);
    if ('updateProjectionMatrix' in camera) {
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [preset, cx, cy, cz, scale, camera]);

  return (
    <OrbitControls
      target={[cx, cy * 0.75, cz]}
      minDistance={scale * 0.28}
      maxDistance={scale * 4.5}
      enableDamping
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

function SceneContent({
  contenedor,
  modeloLabel,
  bultos = [],
  noColocados = [],
  tarimaDims = { largo: 1.2, ancho: 1, alto: 1.5 },
  preset,
  filaFilter,
  highlightedId,
}: CubicajeSceneProps) {
  const maxDim = Math.max(contenedor.largo, contenedor.ancho, contenedor.alto, 1);

  return (
    <>
      <color attach="background" args={['#eef1f5']} />
      <fog attach="fog" args={['#eef1f5', maxDim * 4, maxDim * 14]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[maxDim * 1.5, maxDim * 2.5, maxDim * 1.2]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-maxDim, maxDim, -maxDim * 0.8]} intensity={0.4} />
      <Environment preset="city" />
      <CameraRig preset={preset} contenedor={contenedor} />
      <IsuzuTruck {...contenedor} modeloLabel={modeloLabel} />
      <ContactShadows
        position={[contenedor.largo / 2, 0, contenedor.ancho / 2]}
        opacity={0.35}
        scale={contenedor.largo + 6}
        blur={2.5}
        far={4}
      />
      {bultos.map((b) => (
        <CargoBulto
          key={b.id}
          bulto={b}
          dimmed={filaFilter != null && b.fila !== filaFilter}
          highlighted={highlightedId === b.id}
        />
      ))}
      {noColocados.length > 0 && (
        <UnplacedStack items={noColocados} contenedor={contenedor} tarimaDims={tarimaDims} />
      )}
    </>
  );
}

export function CubicajeScene(props: CubicajeSceneProps) {
  const maxDim = useMemo(
    () => Math.max(props.contenedor.largo, props.contenedor.ancho, props.contenedor.alto, 1),
    [props.contenedor],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: maxDim * 30, position: [maxDim, maxDim * 0.8, maxDim * 1.5] }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
    >
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  );
}

export function CubicajeSceneFromResult({
  result,
  tarimaDims,
  ...rest
}: {
  result: CubicajeResult;
  tarimaDims?: { largo: number; ancho: number; alto: number };
  preset: CameraPreset;
  filaFilter?: number | null;
  highlightedId?: string | null;
}) {
  return (
    <CubicajeScene
      contenedor={result.contenedor}
      modeloLabel={result.modelo}
      bultos={result.bultos}
      noColocados={result.noColocados}
      tarimaDims={tarimaDims}
      {...rest}
    />
  );
}
