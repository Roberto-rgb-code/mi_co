import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraPreset, CubicajeResult } from '../types/cubicaje';
import { IsuzuTruck, CargoBulto, AxleWeightIndicators } from './IsuzuTruckModel';
import { computeAxleLoads } from '../utils/cubicajeAxleWeight';

export interface CubicajeSceneProps {
  contenedor: CubicajeResult['contenedor'];
  modeloLabel?: string;
  bultos?: CubicajeResult['bultos'];
  preset: CameraPreset;
  filaFilter?: number | null;
  highlightedId?: string | null;
  showWeight?: boolean;
  showLabels?: boolean;
}

function CameraRig({
  preset,
  contenedor,
}: {
  preset: CameraPreset;
  contenedor: CubicajeResult['contenedor'];
}) {
  const { camera, size } = useThree();
  const { largo, ancho, alto } = contenedor;
  const cx = largo * 0.42;
  const cy = alto * 0.38;
  const cz = ancho / 2;
  const span = largo + 4;

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    camera.fov = 32;
    camera.aspect = size.width / Math.max(size.height, 1);
    camera.near = 0.1;
    camera.far = span * 8;

    if (preset === 'side') {
      camera.position.set(cx - 0.5, cy + 0.15, cz - span * 0.85);
      camera.lookAt(cx, cy, cz);
    } else if (preset === 'top') {
      camera.position.set(cx, span * 1.1, cz + 0.01);
      camera.lookAt(cx, 0, cz);
    } else {
      camera.position.set(cx + span * 0.55, cy + span * 0.38, cz + span * 0.42);
      camera.lookAt(cx, cy * 0.85, cz);
    }

    camera.updateProjectionMatrix();
  }, [preset, cx, cy, cz, span, camera, size]);

  return null;
}

function SceneContent({
  contenedor,
  bultos = [],
  preset,
  filaFilter,
  highlightedId,
  showWeight = true,
  showLabels = true,
}: CubicajeSceneProps) {
  const cabLen = Math.min(2.1, Math.max(1.55, contenedor.largo * 0.28));
  const axles = useMemo(
    () => computeAxleLoads(bultos, contenedor.largo, cabLen),
    [bultos, contenedor.largo, cabLen],
  );

  return (
    <>
      <color attach="background" args={['#e8ecf1']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[12, 18, 8]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-8, 10, -6]} intensity={0.35} />
      <PerspectiveCamera makeDefault position={[5, 4, 8]} fov={32} />
      <CameraRig preset={preset} contenedor={contenedor} />
      <IsuzuTruck {...contenedor} />
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
          tipo={b.tipo}
          dimmed={filaFilter != null && b.fila !== filaFilter}
          highlighted={highlightedId === b.id}
          showLabel={showLabels}
        />
      ))}
      <AxleWeightIndicators
        axles={axles}
        alto={contenedor.alto}
        ancho={contenedor.ancho}
        visible={showWeight && bultos.length > 0}
      />
    </>
  );
}

export function CubicajeScene(props: CubicajeSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
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
  ...rest
}: {
  result: CubicajeResult;
  preset: CameraPreset;
  filaFilter?: number | null;
  highlightedId?: string | null;
  showWeight?: boolean;
  showLabels?: boolean;
}) {
  return (
    <CubicajeScene contenedor={result.contenedor} bultos={result.bultos} {...rest} />
  );
}
