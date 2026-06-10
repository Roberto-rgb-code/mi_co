import { Line, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { BultoColocado } from '../types/cubicaje';

const WALL_MAT = {
  color: '#64748b',
  transparent: true,
  opacity: 0.12,
  roughness: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,
};

/** Solo el volumen de carga (caja ISUZU), sin cabina ni ruedas. */
export function CargaContainer({
  largo,
  ancho,
  alto,
}: {
  largo: number;
  ancho: number;
  alto: number;
}) {
  const cx = largo / 2;
  const cz = ancho / 2;

  return (
    <group>
      {/* Suelo exterior */}
      <mesh position={[cx, -0.02, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo + 1.2, ancho + 1.2]} />
        <meshStandardMaterial color="#dde3ea" roughness={1} />
      </mesh>

      {/* Piso interior */}
      <mesh position={[cx, 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.95} />
      </mesh>

      {/* Paredes semitransparentes */}
      <mesh position={[cx, alto / 2, 0.025]}>
        <boxGeometry args={[largo, alto, 0.05]} />
        <meshStandardMaterial {...WALL_MAT} />
      </mesh>
      <mesh position={[cx, alto / 2, ancho - 0.025]}>
        <boxGeometry args={[largo, alto, 0.05]} />
        <meshStandardMaterial {...WALL_MAT} />
      </mesh>
      <mesh position={[0.025, alto / 2, cz]}>
        <boxGeometry args={[0.05, alto, ancho]} />
        <meshStandardMaterial {...WALL_MAT} />
      </mesh>
      <mesh position={[largo - 0.025, alto / 2, cz]}>
        <boxGeometry args={[0.05, alto, ancho]} />
        <meshStandardMaterial {...WALL_MAT} />
      </mesh>

      {/* Techo ligero */}
      <mesh position={[cx, alto, cz]}>
        <boxGeometry args={[largo, 0.04, ancho]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.08} />
      </mesh>

      {/* Marco wireframe */}
      {[
        [[0, 0, 0], [largo, 0, 0], [largo, alto, 0], [0, alto, 0], [0, 0, 0]],
        [[0, 0, ancho], [largo, 0, ancho], [largo, alto, ancho], [0, alto, ancho], [0, 0, ancho]],
        [[0, 0, 0], [0, alto, 0]],
        [[largo, 0, 0], [largo, alto, 0]],
        [[0, 0, ancho], [0, alto, ancho]],
        [[largo, 0, ancho], [largo, alto, ancho]],
        [[0, 0, 0], [0, 0, ancho]],
        [[largo, 0, 0], [largo, 0, ancho]],
        [[0, alto, 0], [0, alto, ancho]],
        [[largo, alto, 0], [largo, alto, ancho]],
      ].map((pts, i) => (
        <Line key={i} points={pts as [number, number, number][]} color="#475569" lineWidth={1.5} />
      ))}

      {/* Rejilla cada 0.5 m */}
      {Array.from({ length: Math.floor(largo / 0.5) + 1 }, (_, i) => (
        <Line
          key={`x${i}`}
          points={[[i * 0.5, 0.01, 0], [i * 0.5, 0.01, ancho]]}
          color="#cbd5e1"
        />
      ))}
      {Array.from({ length: Math.floor(ancho / 0.5) + 1 }, (_, i) => (
        <Line
          key={`z${i}`}
          points={[[0, 0.01, i * 0.5], [largo, 0.01, i * 0.5]]}
          color="#cbd5e1"
        />
      ))}
    </group>
  );
}

/** @deprecated Usar CargaContainer */
export const IsuzuTruck = CargaContainer;

const TIPO_COLOR: Record<string, string> = {
  pequena: '#ef4444',
  mediana: '#eab308',
  grande: '#3b82f6',
  tarima: '#f97316',
};

function shortLabel(text: string, max = 14): string {
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
  const opacity = dimmed ? 0.12 : 0.93;
  const fontSize = Math.min(bulto.largo, bulto.alto, bulto.ancho) * 0.13;

  return (
    <group position={[cx, cy, cz]}>
      <RoundedBox
        args={[bulto.largo * 0.97, bulto.alto * 0.97, bulto.ancho * 0.97]}
        radius={0.01}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={fill} roughness={0.4} transparent opacity={opacity} />
      </RoundedBox>
      {showLabel && fontSize > 0.035 && !dimmed && (
        <Text
          position={[0, bulto.alto * 0.02, bulto.ancho * 0.5]}
          fontSize={fontSize}
          maxWidth={bulto.largo * 0.9}
          color="#fff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={fontSize * 0.06}
          outlineColor="#1e293b"
        >
          {shortLabel(bulto.label)}
        </Text>
      )}
    </group>
  );
}
