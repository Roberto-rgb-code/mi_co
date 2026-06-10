import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { CameraPreset, CubicajeResult } from '../types/cubicaje';
import { CargaContainer, CargoBulto } from './IsuzuTruckModel';

export interface CubicajeSceneProps {
  contenedor: CubicajeResult['contenedor'];
  bultos?: CubicajeResult['bultos'];
  preset: CameraPreset;
  filaFilter?: number | null;
  highlightedId?: string | null;
  showLabels?: boolean;
  zoomFactor?: number;
  viewResetKey?: number;
}

function getCameraFrame(contenedor: CubicajeResult['contenedor'], preset: CameraPreset) {
  const { largo, ancho, alto } = contenedor;
  const cx = largo / 2;
  const cy = alto / 2;
  const cz = ancho / 2;
  const span = Math.max(largo, ancho, alto, 2) + 1.2;

  let position: THREE.Vector3;
  if (preset === 'side') {
    position = new THREE.Vector3(cx, cy, cz - span * 1.15);
  } else if (preset === 'top') {
    position = new THREE.Vector3(cx, span * 1.25, cz);
  } else {
    position = new THREE.Vector3(cx + span * 0.85, cy + span * 0.55, cz + span * 0.85);
  }

  return { target: new THREE.Vector3(cx, cy, cz), position, span };
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

    camera.fov = 38;
    camera.aspect = size.width / Math.max(size.height, 1);
    camera.near = 0.05;
    camera.far = frame.span * 10;
    camera.updateProjectionMatrix();

    const dir = frame.position.clone().sub(frame.target).normalize();
    const dist = frame.position.distanceTo(frame.target) / zoomFactor;
    camera.position.copy(frame.target).add(dir.multiplyScalar(dist));

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(frame.target);
      controls.minDistance = frame.span * 0.25;
      controls.maxDistance = frame.span * 4;
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
      maxPolarAngle={Math.PI / 2.01}
      minPolarAngle={0.08}
    />
  );
}

function SceneContent({
  contenedor,
  bultos = [],
  preset,
  filaFilter,
  highlightedId,
  showLabels = true,
  zoomFactor = 1,
  viewResetKey = 0,
}: CubicajeSceneProps) {
  return (
    <>
      <color attach="background" args={['#eef2f6']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 8, -4]} intensity={0.3} />
      <PerspectiveCamera makeDefault fov={38} />
      <CameraRig
        preset={preset}
        contenedor={contenedor}
        zoomFactor={zoomFactor}
        viewResetKey={viewResetKey}
      />
      <CargaContainer {...contenedor} />
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
  showLabels?: boolean;
  zoomFactor?: number;
  viewResetKey?: number;
}) {
  return (
    <CubicajeScene contenedor={result.contenedor} bultos={result.bultos} {...rest} />
  );
}
