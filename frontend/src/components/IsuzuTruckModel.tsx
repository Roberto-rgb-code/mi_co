import { Edges, Line, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { BultoColocado } from '../types/cubicaje';
import type { AxleLoad } from '../utils/cubicajeAxleWeight';
import { formatKg } from '../utils/cubicajeAxleWeight';

const ISUZU_RED = '#c8102e';
const TRAILER_GLASS = '#4a90c4';

const WALL_MAT = {
  color: TRAILER_GLASS,
  transparent: true,
  opacity: 0.22,
  roughness: 0.15,
  metalness: 0.05,
  side: THREE.DoubleSide,
  depthWrite: false,
};

function Wheel({ x, z, r = 0.26 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, r * 0.85, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, 0.12, 24]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.55, r * 0.55, 0.13, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function IsuzuTruck({
  largo,
  ancho,
  alto,
}: {
  largo: number;
  ancho: number;
  alto: number;
  modeloLabel?: string;
}) {
  const cabLen = Math.min(2.1, Math.max(1.55, largo * 0.28));
  const cabH = alto * 0.92;
  const bodyH = alto;
  const cabFront = -cabLen * 0.15;
  const cz = ancho / 2;
  const wheelR = Math.min(0.28, alto * 0.13);

  return (
    <group>
      <mesh position={[largo / 2, -0.02, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo + cabLen + 8, ancho + 6]} />
        <meshStandardMaterial color="#d8dee6" roughness={1} />
      </mesh>

      <mesh position={[largo / 2 - cabLen * 0.2, wheelR * 0.55, cz]}>
        <boxGeometry args={[largo + cabLen * 0.85, 0.08, ancho * 0.6]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Cabina azul-gris estilo semirremolque */}
      <group position={[cabFront, 0, 0]}>
        <RoundedBox
          args={[cabLen, cabH * 0.55, ancho * 0.96]}
          radius={0.06}
          smoothness={4}
          position={[0, cabH * 0.32 + wheelR * 0.5, cz]}
          castShadow
        >
          <meshStandardMaterial color="#3b5998" roughness={0.35} metalness={0.12} />
          <Edges color="#1e3a5f" threshold={15} />
        </RoundedBox>
        <RoundedBox
          args={[cabLen * 0.85, cabH * 0.32, ancho * 0.92]}
          radius={0.04}
          smoothness={4}
          position={[cabLen * 0.02, cabH * 0.74 + wheelR * 0.5, cz]}
        >
          <meshStandardMaterial color="#2d4373" roughness={0.3} />
        </RoundedBox>
        <mesh position={[cabLen * 0.15, cabH * 0.68 + wheelR * 0.5, ancho * 0.94]}>
          <boxGeometry args={[cabLen * 0.42, cabH * 0.24, 0.05]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
        </mesh>
        <mesh position={[-cabLen * 0.48, cabH * 0.26 + wheelR * 0.5, cz]}>
          <boxGeometry args={[0.08, cabH * 0.36, ancho * 0.75]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
        <mesh position={[cabLen * 0.35, cabH * 0.18 + wheelR * 0.5, cz - ancho * 0.48]}>
          <boxGeometry args={[0.04, cabH * 0.12, ancho * 0.35]} />
          <meshStandardMaterial color={ISUZU_RED} />
        </mesh>
      </group>

      <Wheel x={cabFront + cabLen * 0.35} z={cz - ancho * 0.38} r={wheelR} />
      <Wheel x={cabFront + cabLen * 0.35} z={cz + ancho * 0.38} r={wheelR} />
      <Wheel x={largo * 0.78} z={cz - ancho * 0.38} r={wheelR * 1.05} />
      <Wheel x={largo * 0.78} z={cz + ancho * 0.38} r={wheelR * 1.05} />
      <Wheel x={largo * 0.92} z={cz - ancho * 0.38} r={wheelR * 1.05} />
      <Wheel x={largo * 0.92} z={cz + ancho * 0.38} r={wheelR * 1.05} />

      {/* Caja semitransparente */}
      <group>
        <mesh position={[largo / 2, 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[largo - 0.06, ancho - 0.06]} />
          <meshStandardMaterial color="#c4b5a0" roughness={0.95} />
        </mesh>

        {/* Paredes vidrio */}
        <mesh position={[largo / 2, bodyH / 2, 0.035]}>
          <boxGeometry args={[largo, bodyH, 0.07]} />
          <meshStandardMaterial {...WALL_MAT} />
        </mesh>
        <mesh position={[largo / 2, bodyH / 2, ancho - 0.035]}>
          <boxGeometry args={[largo, bodyH, 0.07]} />
          <meshStandardMaterial {...WALL_MAT} />
        </mesh>
        <mesh position={[0.035, bodyH / 2, cz]}>
          <boxGeometry args={[0.07, bodyH, ancho]} />
          <meshStandardMaterial {...WALL_MAT} />
        </mesh>
        <mesh position={[largo - 0.035, bodyH / 2, cz]}>
          <boxGeometry args={[0.07, bodyH, ancho]} />
          <meshStandardMaterial {...WALL_MAT} />
        </mesh>

        {/* Techo */}
        <mesh position={[largo / 2, bodyH, cz]}>
          <boxGeometry args={[largo, 0.06, ancho]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} />
        </mesh>

        {/* Marco */}
        <Line points={[[0, 0, 0], [largo, 0, 0], [largo, bodyH, 0], [0, bodyH, 0], [0, 0, 0]]} color="#64748b" />
        <Line points={[[0, 0, ancho], [largo, 0, ancho], [largo, bodyH, ancho], [0, bodyH, ancho], [0, 0, ancho]]} color="#64748b" />
        <Line points={[[0, 0, 0], [0, 0, ancho]]} color="#64748b" />
        <Line points={[[largo, 0, 0], [largo, 0, ancho]]} color="#64748b" />
        <Line points={[[0, bodyH, 0], [0, bodyH, ancho]]} color="#64748b" />
        <Line points={[[largo, bodyH, 0], [largo, bodyH, ancho]]} color="#64748b" />

        {/* Rejilla suelo */}
        {Array.from({ length: Math.floor(largo / 0.5) + 1 }, (_, i) => (
          <Line
            key={`g${i}`}
            points={[[i * 0.5, 0.02, 0.06], [i * 0.5, 0.02, ancho - 0.06]]}
            color="#94a3b8"
            transparent
            opacity={0.4}
          />
        ))}
      </group>
    </group>
  );
}

const TIPO_COLOR: Record<string, string> = {
  pequena: '#ef4444',
  mediana: '#eab308',
  grande: '#3b82f6',
  tarima: '#f97316',
};

function shortLabel(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function CargoBulto({
  bulto,
  dimmed,
  highlighted,
  tipo,
  showLabel,
}: {
  bulto: Pick<BultoColocado, 'x' | 'y' | 'z' | 'largo' | 'ancho' | 'alto' | 'color' | 'id' | 'label'>;
  dimmed: boolean;
  highlighted: boolean;
  tipo?: string;
  showLabel?: boolean;
}) {
  const cx = bulto.x + bulto.largo / 2;
  const cy = bulto.y + bulto.alto / 2;
  const cz = bulto.z + bulto.ancho / 2;
  const fill = highlighted ? '#fb923c' : (TIPO_COLOR[tipo || ''] || bulto.color);
  const opacity = dimmed ? 0.15 : 0.92;
  const fontSize = Math.min(bulto.largo, bulto.alto, bulto.ancho) * 0.14;

  return (
    <group position={[cx, cy, cz]}>
      <RoundedBox
        args={[bulto.largo * 0.96, bulto.alto * 0.96, bulto.ancho * 0.96]}
        radius={0.012}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={fill}
          roughness={0.45}
          metalness={0.02}
          transparent
          opacity={opacity}
        />
        <Edges color="#1e293b" threshold={20} />
      </RoundedBox>
      {showLabel && fontSize > 0.04 && !dimmed && (
        <Text
          position={[0, 0, bulto.ancho * 0.49]}
          fontSize={fontSize}
          maxWidth={bulto.largo * 0.88}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={fontSize * 0.08}
          outlineColor="#1e293b"
        >
          {shortLabel(bulto.label)}
        </Text>
      )}
    </group>
  );
}

/** Flechas verdes de peso en ejes (estilo EasyCargo). */
export function AxleWeightIndicators({
  axles,
  alto,
  ancho,
  visible,
}: {
  axles: AxleLoad[];
  alto: number;
  ancho: number;
  visible: boolean;
}) {
  if (!visible) return null;

  const arrowH = alto + 0.8;
  const cz = ancho / 2;

  return (
    <group>
      {axles.map((axle, i) => (
        <group key={i} position={[axle.x, 0, cz]}>
          {/* Flecha verde */}
          <mesh position={[0, arrowH / 2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, arrowH, 8]} />
            <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.12, 0.22, 8]} />
            <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.3} />
          </mesh>
          {/* Etiqueta peso */}
          <Text
            position={[0, arrowH + 0.18, 0]}
            fontSize={0.14}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#166534"
          >
            {formatKg(axle.kg)}
          </Text>
        </group>
      ))}
    </group>
  );
}
