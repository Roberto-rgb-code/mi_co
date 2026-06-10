import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { CameraPreset, CubicajeResult } from '../types/cubicaje';
import { IsuzuTruckVisual, CargoBulto, getCabLength } from './IsuzuTruckModel';

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
  const cabLen = getCabLength(largo);
  const totalL = largo + cabLen;
  const cx = (largo - cabLen) / 2;
  const cy = alto / 2;
  const cz = ancho / 2;
  const span = Math.max(totalL, ancho, alto, 2) + 1;

  let position: THREE.Vector3;
  let ortho = false;

  if (preset === 'side') {
    position = new THREE.Vector3(cx, cy, cz - span * 1.25);
    ortho = true;
  } else if (preset === 'top') {
    position = new THREE.Vector3(cx, span * 1.3, cz);
    ortho = true;
  } else {
    position = new THREE.Vector3(cx + totalL * 0.55, cy + span * 0.42, cz + totalL * 0.42);
  }

  return { target: new THREE.Vector3(cx, cy, cz), position, span, ortho, totalL, cabLen, alto, ancho, largo };
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
  const { camera, size, set } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const frame = useMemo(() => getCameraFrame(contenedor, preset), [contenedor, preset]);

  useEffect(() => {
    if (frame.ortho) {
      if (!(camera instanceof THREE.OrthographicCamera)) {
        set({ camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, frame.span * 12) });
      }
    } else if (!(camera instanceof THREE.PerspectiveCamera)) {
      set({
        camera: new THREE.PerspectiveCamera(34, size.width / Math.max(size.height, 1), 0.05, frame.span * 12),
      });
    }
  }, [frame.ortho, frame.span, camera, set, size]);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const pad = 1.15 / zoomFactor;

    if (camera instanceof THREE.OrthographicCamera) {
      let halfW: number;
      let halfH: number;

      if (preset === 'side') {
        halfW = (frame.totalL * pad) / 2;
        halfH = (frame.alto * pad) / 2;
      } else {
        halfW = (frame.largo * pad) / 2;
        halfH = (frame.ancho * pad) / 2;
      }

      if (halfW / halfH > aspect) halfH = halfW / aspect;
      else halfW = halfH * aspect;

      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.near = 0.1;
      camera.far = frame.span * 12;
      camera.position.copy(frame.position);
      camera.lookAt(frame.target);
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 34;
      camera.aspect = aspect;
      camera.near = 0.05;
      camera.far = frame.span * 12;
      camera.updateProjectionMatrix();
      const dir = frame.position.clone().sub(frame.target).normalize();
      const dist = frame.position.distanceTo(frame.target) / zoomFactor;
      camera.position.copy(frame.target).add(dir.multiplyScalar(dist));
    }

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(frame.target);
      controls.minDistance = frame.span * 0.25;
      controls.maxDistance = frame.span * 5;
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
      minPolarAngle={0.06}
    />
  );
}

function SceneContent(props: CubicajeSceneProps) {
  const {
    contenedor,
    bultos = [],
    preset,
    filaFilter,
    highlightedId,
    showLabels = true,
    zoomFactor = 1,
    viewResetKey = 0,
  } = props;

  return (
    <>
      <color attach="background" args={['#eef2f7']} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 0.5]} />
      <directionalLight position={[8, 12, 6]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 8, -4]} intensity={0.25} />
      <OrthographicCamera makeDefault position={[0, 0, 5]} near={0.1} far={200} />
      <CameraRig preset={preset} contenedor={contenedor} zoomFactor={zoomFactor} viewResetKey={viewResetKey} />
      <IsuzuTruckVisual {...contenedor} />
      {bultos.map((b) => (
        <CargoBulto
          key={b.id}
          bulto={b}
          box={contenedor}
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
      dpr={[1, 2]}
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
  return <CubicajeScene contenedor={result.contenedor} bultos={result.bultos} {...rest} />;
}
