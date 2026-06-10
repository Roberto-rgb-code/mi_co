import { Edges, Line, RoundedBox, Text } from '@react-three/drei';
import type { BultoColocado } from '../types/cubicaje';

const EDGE = '#334155';
const FLOOR = '#d4c4a8';

/** Volumen de carga abierto (wireframe), sin cabina ni camión. Origen en esquina piso-frente-izq. */
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
  const cy = alto / 2;
  const cz = ancho / 2;

  const corners: [number, number, number][] = [
    [0, 0, 0],
    [largo, 0, 0],
    [largo, 0, ancho],
    [0, 0, ancho],
    [0, alto, 0],
    [largo, alto, 0],
    [largo, alto, ancho],
    [0, alto, ancho],
  ];

  const edges: [number, number, number][][] = [
    [corners[0], corners[1], corners[2], corners[3], corners[0]],
    [corners[4], corners[5], corners[6], corners[7], corners[4]],
    [corners[0], corners[4]],
    [corners[1], corners[5]],
    [corners[2], corners[6]],
    [corners[3], corners[7]],
  ];

  return (
    <group>
      {/* Suelo exterior */}
      <mesh position={[cx, -0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo + 2, ancho + 2]} />
        <meshStandardMaterial color="#e2e8f0" roughness={1} />
      </mesh>

      {/* Piso de carga */}
      <mesh position={[cx, 0.004, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>

      {/* Volumen de referencia (muy sutil) */}
      <mesh position={[cx, cy, cz]}>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.04} depthWrite={false} />
        <Edges color={EDGE} threshold={15} />
      </mesh>

      {/* Aristas principales más gruesas */}
      {edges.map((pts, i) => (
        <Line key={i} points={pts} color={EDGE} lineWidth={2} />
      ))}

      {/* Puerta de carga (x=0) resaltada */}
      <Line
        points={[
          [0, 0, 0],
          [0, alto, 0],
          [0, alto, ancho],
          [0, 0, ancho],
          [0, 0, 0],
        ]}
        color="#c8102e"
        lineWidth={2.5}
      />

      {/* Rejilla cada 0.5 m */}
      {Array.from({ length: Math.floor(largo / 0.5) + 1 }, (_, i) => (
        <Line
          key={`gx${i}`}
          points={[[i * 0.5, 0.012, 0], [i * 0.5, 0.012, ancho]]}
          color="#94a3b8"
          transparent
          opacity={0.55}
        />
      ))}
      {Array.from({ length: Math.floor(ancho / 0.5) + 1 }, (_, i) => (
        <Line
          key={`gz${i}`}
          points={[[0, 0.012, i * 0.5], [largo, 0.012, i * 0.5]]}
          color="#94a3b8"
          transparent
          opacity={0.55}
        />
      ))}

      {/* Etiqueta de dimensiones */}
      <Text
        position={[cx, alto + 0.12, cz]}
        fontSize={Math.min(largo, ancho, alto) * 0.09}
        color="#475569"
        anchorX="center"
        anchorY="bottom"
      >
        {`${largo.toFixed(2)} × ${ancho.toFixed(2)} × ${alto.toFixed(2)} m`}
      </Text>
    </group>
  );
}

export const IsuzuTruck = CargaContainer;

const TIPO_COLOR: Record<string, string> = {
  pequena: '#dc2626',
  mediana: '#ca8a04',
  grande: '#2563eb',
  tarima: '#ea580c',
};

function shortLabel(text: string, max = 12): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function clampBulto(
  bulto: Pick<BultoColocado, 'x' | 'y' | 'z' | 'largo' | 'ancho' | 'alto'>,
  box: { largo: number; ancho: number; alto: number },
) {
  const x = Math.max(0, Math.min(bulto.x, box.largo - 0.01));
  const y = Math.max(0, Math.min(bulto.y, box.alto - 0.01));
  const z = Math.max(0, Math.min(bulto.z, box.ancho - 0.01));
  const largo = Math.min(bulto.largo, box.largo - x);
  const ancho = Math.min(bulto.ancho, box.ancho - z);
  const alto = Math.min(bulto.alto, box.alto - y);
  return { x, y, z, largo, ancho, alto };
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
  const c = clampBulto(bulto, box);
  const cx = c.x + c.largo / 2;
  const cy = c.y + c.alto / 2;
  const cz = c.z + c.ancho / 2;
  const fill = highlighted ? '#f97316' : (TIPO_COLOR[tipo || ''] || bulto.color);
  const opacity = dimmed ? 0.2 : 1;
  const fontSize = Math.min(c.largo, c.alto, c.ancho) * 0.11;

  return (
    <group position={[cx, cy, cz]}>
      <RoundedBox
        args={[c.largo * 0.96, c.alto * 0.96, c.ancho * 0.96]}
        radius={0.008}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={fill}
          roughness={0.35}
          metalness={0.02}
          transparent={dimmed}
          opacity={opacity}
        />
        <Edges color="#1e293b" threshold={12} />
      </RoundedBox>
      {showLabel && fontSize > 0.03 && !dimmed && (
        <Text
          position={[0, c.alto * 0.48, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={fontSize}
          maxWidth={c.largo * 0.92}
          color="#fff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={fontSize * 0.07}
          outlineColor="#1e293b"
        >
          {shortLabel(bulto.label)}
        </Text>
      )}
    </group>
  );
}
