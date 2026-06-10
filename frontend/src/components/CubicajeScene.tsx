import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
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
  zoomFactor?: number;
  viewResetKey?: number;
}

function getCameraFrame(contenedor: CubicajeResult['contenedor'], preset: CameraPreset) {
  const { largo, ancho, alto } = contenedor;
  const cabLen = Math.min(2.1, Math.max(1.55, largo * 0.28));
  const cabFront = -cabLen * 0.15;
  const cx = (cabFront + largo) / 2;
  const cy = alto * 0.42;
  const cz = ancho / 2;
  const span = Math.max(largo + cabLen + 1.5, ancho + 1, alto + 1, 5);

  let position: THREE.Vector3;
  if (preset === 'side') {
    position = new THREE.Vector3(cx, cy + span * 0.05, cz - span * 1.05);
  } else if (preset === 'top') {
    position = new THREE.Vector3(cx, span * 1.35, cz + 0.01);
  } else {
    position = new THREE.Vector3(cx + span * 0.72, cy + span * 0.48, cz + span * 0.72);
  }

  return {
    target: new THREE.Vector3(cx, cy, cz),
    position,
    span,
  };
}

function CameraRig({
  preset,
  contenedor,
  zoomFactor = 1,
  viewResetKey = 0,
}: {
  preset: CameraPreset;
  contenedor: CubicajeResult['contenedor'];
  zoomFactor?: number;
  viewResetKey?: number;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const frame = useMemo(() => getCameraFrame(contenedor, preset), [contenedor, preset]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    camera.fov = 42;
    camera.aspect = size.width / Math.max(size.height, 1);
    camera.near = 0.05;
    camera.far = frame.span * 12;
    camera.updateProjectionMatrix();

    const dir = frame.position.clone().sub(frame.target).normalize();
    const dist = frame.position.distanceTo(frame.target) / zoomFactor;
    camera.position.copy(frame.target).add(dir.multiplyScalar(dist));

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(frame.target);
      controls.minDistance = frame.span * 0.18;
      controls.maxDistance = frame.span * 3.5;
      controls.update();
    }
  }, [preset, zoomFactor, viewResetKey, frame, camera, size]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enablePan
      enableZoom
      enableRotate
      maxPolarAngle={Math.PI / 2.02}
      minPolarAngle={0.05}
    />
  );
}

function SceneContent({
  contenedor,
  bultos = [],
  preset,
  filaFilter,
  highlightedId,
  showWeight = true,
  showLabels = true,
  zoomFactor = 1,
  viewResetKey = 0,
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
      <PerspectiveCamera makeDefault position={[5, 4, 8]} fov={42} />
      <CameraRig
        preset={preset}
        contenedor={contenedor}
        zoomFactor={zoomFactor}
        viewResetKey={viewResetKey}
      />
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
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
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
  zoomFactor?: number;
  viewResetKey?: number;
}) {
  return (
    <CubicajeScene contenedor={result.contenedor} bultos={result.bultos} {...rest} />
  );
}
