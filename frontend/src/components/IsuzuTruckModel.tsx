import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { BultoColocado } from '../types/cubicaje';

const ISUZU_RED = '#c8102e';
const TRAILER_GLASS = {
  color: '#64748b',
  transparent: true,
  opacity: 0.12,
  roughness: 0.15,
  side: THREE.DoubleSide,
  depthWrite: false,
};

export function getCabLength(largo: number): number {
  return Math.min(2.0, Math.max(1.35, largo * 0.24));
}

function Wheel({ x, z, r = 0.22 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, r * 0.82, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, 0.1, 20]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.52, r * 0.52, 0.11, 14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  );
}

function TrailerCargoBox({ largo, ancho, alto }: { largo: number; ancho: number; alto: number }) {
  const cx = largo / 2;
  const cy = alto / 2;
  const cz = ancho / 2;

  return (
    <group>
      <mesh position={[cx, 0.006, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial color="#dcc9a8" roughness={0.95} />
      </mesh>

      <mesh position={[cx, cy, 0.025]}>
        <boxGeometry args={[largo, alto, 0.04]} />
        <meshStandardMaterial {...TRAILER_GLASS} />
      </mesh>
      <mesh position={[cx, cy, ancho - 0.025]}>
        <boxGeometry args={[largo, alto, 0.04]} />
        <meshStandardMaterial {...TRAILER_GLASS} />
      </mesh>
      <mesh position={[largo - 0.025, cy, cz]}>
        <boxGeometry args={[0.04, alto, ancho]} />
        <meshStandardMaterial {...TRAILER_GLASS} />
      </mesh>
      <mesh position={[cx, alto, cz]}>
        <boxGeometry args={[largo, 0.04, ancho]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.15} />
      </mesh>
      <mesh position={[0.025, cy, cz]}>
        <boxGeometry args={[0.04, alto, ancho]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} opacity={0.7} transparent />
      </mesh>
    </group>
  );
}

export function IsuzuTruckVisual({
  largo,
  ancho,
  alto,
}: {
  largo: number;
  ancho: number;
  alto: number;
}) {
  const cabLen = getCabLength(largo);
  const cz = ancho / 2;
  const wheelR = Math.min(0.22, alto * 0.11);
  const cabCx = -cabLen / 2;
  const truckCx = (largo - cabLen) / 2;

  return (
    <group>
      <mesh position={[truckCx, -0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo + cabLen + 2.5, ancho + 2]} />
        <meshStandardMaterial color="#e2e8f0" roughness={1} />
      </mesh>

      <mesh position={[truckCx, wheelR * 0.45, cz]}>
        <boxGeometry args={[largo + cabLen, 0.06, ancho * 0.55]} />
        <meshStandardMaterial color="#475569" metalness={0.35} roughness={0.55} />
      </mesh>

      <group>
        <RoundedBox
          args={[cabLen, alto * 0.62, ancho * 0.9]}
          radius={0.05}
          smoothness={3}
          position={[cabCx, alto * 0.34 + wheelR * 0.45, cz]}
          castShadow
        >
          <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.05} />
        </RoundedBox>
        <RoundedBox
          args={[cabLen * 0.88, alto * 0.28, ancho * 0.86]}
          radius={0.04}
          smoothness={3}
          position={[cabCx + cabLen * 0.02, alto * 0.72 + wheelR * 0.45, cz]}
        >
          <meshStandardMaterial color={ISUZU_RED} roughness={0.35} />
        </RoundedBox>
        <mesh position={[cabCx + cabLen * 0.15, alto * 0.65 + wheelR * 0.45, cz + ancho * 0.44]}>
          <boxGeometry args={[cabLen * 0.35, alto * 0.2, 0.04]} />
          <meshStandardMaterial color="#bae6fd" transparent opacity={0.75} />
        </mesh>
        <mesh position={[cabCx - cabLen * 0.48, alto * 0.28 + wheelR * 0.45, cz]}>
          <boxGeometry args={[0.06, alto * 0.35, ancho * 0.65]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
      </group>

      <Wheel x={cabCx - cabLen * 0.28} z={cz - ancho * 0.38} r={wheelR} />
      <Wheel x={cabCx - cabLen * 0.28} z={cz + ancho * 0.38} r={wheelR} />
      <Wheel x={cabCx + cabLen * 0.22} z={cz - ancho * 0.38} r={wheelR} />
      <Wheel x={cabCx + cabLen * 0.22} z={cz + ancho * 0.38} r={wheelR} />
      <Wheel x={largo * 0.78} z={cz - ancho * 0.38} r={wheelR * 1.05} />
      <Wheel x={largo * 0.78} z={cz + ancho * 0.38} r={wheelR * 1.05} />

      <mesh position={[largo * 0.55, alto * 0.55, ancho - 0.01]}>
        <boxGeometry args={[largo * 0.7, 0.08, 0.015]} />
        <meshStandardMaterial color={ISUZU_RED} />
      </mesh>

      <TrailerCargoBox largo={largo} ancho={ancho} alto={alto} />
    </group>
  );
}

export const CargaContainer = IsuzuTruckVisual;
export const IsuzuTruck = IsuzuTruckVisual;

const TIPO_COLOR: Record<string, string> = {
  pequena: '#ef4444',
  mediana: '#eab308',
  grande: '#3b82f6',
  tarima: '#fb923c',
  tambo: '#0891b2',
};

function shortLabel(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function CargoBulto({
  bulto,
  box,
  dimmed,
  highlighted,
  tipo,
  showLabel,
}: {
  bulto: Pick<BultoColocado, 'x' | 'y' | 'z' | 'largo' | 'ancho' | 'alto' | 'color' | 'id' | 'label'>;
  box: { largo: number; ancho: number; alto: number };
  dimmed: boolean;
  highlighted: boolean;
  tipo?: string;
  showLabel?: boolean;
}) {
  const x = Math.max(0, Math.min(bulto.x, box.largo - 0.01));
  const y = Math.max(0, Math.min(bulto.y, box.alto - 0.01));
  const z = Math.max(0, Math.min(bulto.z, box.ancho - 0.01));
  const bl = Math.min(bulto.largo, box.largo - x);
  const bh = Math.min(bulto.alto, box.alto - y);
  const bw = Math.min(bulto.ancho, box.ancho - z);

  const cx = x + bl / 2;
  const cy = y + bh / 2;
  const cz = z + bw / 2;
  const fill = highlighted ? '#f97316' : (TIPO_COLOR[tipo || ''] || bulto.color);
  const opacity = dimmed ? 0.18 : 0.94;
  const isCylinder = tipo === 'tambo';
  const minSize = isCylinder ? Math.min(bl, bw) : Math.min(bl, bh, bw);
  const showTag = showLabel && !dimmed && minSize > 0.35;

  return (
    <group position={[cx, cy, cz]}>
      {isCylinder ? (
        <>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[Math.min(bl, bw) * 0.48, Math.min(bl, bw) * 0.48, bh * 0.96, 28]} />
            <meshStandardMaterial
              color={fill}
              roughness={0.32}
              metalness={0.18}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, bh * 0.48 - 0.015, 0]}>
            <cylinderGeometry args={[Math.min(bl, bw) * 0.42, Math.min(bl, bw) * 0.42, 0.03, 24]} />
            <meshStandardMaterial
              color="#334155"
              roughness={0.45}
              metalness={0.35}
              transparent
              opacity={opacity}
            />
          </mesh>
        </>
      ) : (
        <RoundedBox args={[bl * 0.96, bh * 0.96, bw * 0.96]} radius={0.01} smoothness={2} castShadow receiveShadow>
          <meshStandardMaterial color={fill} roughness={0.4} transparent opacity={opacity} />
        </RoundedBox>
      )}
      {showTag && (
        <Html center position={[0, bh * 0.52, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
          <span className="cubicaje-bulto-tag">{shortLabel(bulto.label)}</span>
        </Html>
      )}
    </group>
  );
}
