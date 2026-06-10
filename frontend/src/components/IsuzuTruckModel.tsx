import { Edges, Line, RoundedBox, Text } from '@react-three/drei';
import type { BultoColocado, BultoNoColocado } from '../types/cubicaje';
import { TIPOS_BULTO } from '../types/cubicaje';

const ISUZU_RED = '#c8102e';
const CAB_WHITE = '#f4f4f5';
const BOX_WHITE = '#ffffff';
const CHASSIS = '#3f3f46';

function Wheel({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const r = 0.22 * scale;
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r, r, 0.14 * scale, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.85} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r * 0.55, r * 0.55, 0.15 * scale, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Camión ISUZU procedural: cabina + caja seca con corte lateral para ver la carga. */
export function IsuzuTruck({
  largo,
  ancho,
  alto,
  modeloLabel,
}: {
  largo: number;
  ancho: number;
  alto: number;
  modeloLabel?: string;
}) {
  const cabLen = Math.min(2.0, Math.max(1.4, largo * 0.22));
  const cabH = alto * 0.88;
  const cabW = ancho * 0.96;
  const cabX = -cabLen * 0.52;
  const wheelY = 0.22;
  const cz = ancho / 2;

  return (
    <group>
      {/* Suelo / asfalto bajo el camión */}
      <mesh position={[largo / 2, -0.02, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo + cabLen + 4, ancho + 3]} />
        <meshStandardMaterial color="#dfe3e8" roughness={0.95} />
      </mesh>

      {/* Chasis */}
      <mesh position={[largo / 2 - cabLen * 0.3, 0.12, cz]}>
        <boxGeometry args={[largo + cabLen * 0.8, 0.08, cabW * 0.65]} />
        <meshStandardMaterial color={CHASSIS} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* ── Cabina ── */}
      <group position={[cabX, 0, 0]}>
        {/* Base blanca */}
        <RoundedBox args={[cabLen, cabH * 0.55, cabW]} radius={0.04} smoothness={4} position={[0, cabH * 0.32, cz]}>
          <meshStandardMaterial color={CAB_WHITE} roughness={0.35} metalness={0.08} />
        </RoundedBox>
        {/* Techo cabina rojo ISUZU */}
        <RoundedBox args={[cabLen * 0.92, cabH * 0.42, cabW * 0.94]} radius={0.05} smoothness={4} position={[0, cabH * 0.72, cz]}>
          <meshStandardMaterial color={ISUZU_RED} roughness={0.3} metalness={0.12} />
        </RoundedBox>
        {/* Parabrisas */}
        <mesh position={[cabLen * 0.22, cabH * 0.62, cz + cabW * 0.46]}>
          <boxGeometry args={[cabLen * 0.35, cabH * 0.28, 0.03]} />
          <meshStandardMaterial color="#7dd3fc" transparent opacity={0.65} roughness={0.05} metalness={0.2} />
        </mesh>
        {/* Rejilla frontal */}
        <mesh position={[-cabLen * 0.48, cabH * 0.28, cz]}>
          <boxGeometry args={[0.06, cabH * 0.35, cabW * 0.7]} />
          <meshStandardMaterial color="#27272a" roughness={0.6} />
        </mesh>
        {/* Faros */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-cabLen * 0.49, cabH * 0.22, cz + s * cabW * 0.38]}>
            <boxGeometry args={[0.05, 0.12, 0.18]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.35} />
          </mesh>
        ))}
        {/* Logo ISUZU simplificado */}
        <mesh position={[-cabLen * 0.42, cabH * 0.45, cz + cabW * 0.47]}>
          <boxGeometry args={[0.02, 0.08, 0.25]} />
          <meshStandardMaterial color={ISUZU_RED} />
        </mesh>
      </group>

      {/* Ruedas cabina */}
      <Wheel position={[cabX - cabLen * 0.15, wheelY, 0.08]} />
      <Wheel position={[cabX - cabLen * 0.15, wheelY, ancho - 0.08]} />
      <Wheel position={[cabX + cabLen * 0.25, wheelY, 0.08]} />
      <Wheel position={[cabX + cabLen * 0.25, wheelY, ancho - 0.08]} />

      {/* Ruedas traseras (doble eje) */}
      {[0.72, 0.88].map((f) => (
        <group key={f}>
          <Wheel position={[largo * f, wheelY, 0.06]} scale={1.05} />
          <Wheel position={[largo * f, wheelY, ancho - 0.06]} scale={1.05} />
        </group>
      ))}

      {/* ── Caja de carga (exterior sólido + interior visible) ── */}
      <group>
        {/* Piso interior madera */}
        <mesh position={[largo / 2, 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[largo - 0.02, ancho - 0.02]} />
          <meshStandardMaterial color="#d4b896" roughness={0.9} />
        </mesh>

        {/* Pared derecha sólida (exterior blanco) */}
        <mesh position={[largo / 2, alto / 2, ancho]} castShadow>
          <boxGeometry args={[largo, alto, 0.06]} />
          <meshStandardMaterial color={BOX_WHITE} roughness={0.25} metalness={0.05} />
        </mesh>
        {/* Franja ISUZU lateral */}
        <mesh position={[largo / 2, alto * 0.55, ancho + 0.031]}>
          <boxGeometry args={[largo * 0.85, 0.14, 0.01]} />
          <meshStandardMaterial color={ISUZU_RED} />
        </mesh>

        {/* Pared trasera */}
        <mesh position={[largo - 0.03, alto / 2, cz]} castShadow>
          <boxGeometry args={[0.06, alto, ancho]} />
          <meshStandardMaterial color={BOX_WHITE} roughness={0.25} />
        </mesh>
        {/* Puertas traseras (línea central) */}
        <Line points={[[largo - 0.02, 0.05, 0.05], [largo - 0.02, alto - 0.05, ancho - 0.05]]} color="#d1d5db" lineWidth={1} />

        {/* Techo caja */}
        <mesh position={[largo / 2, alto, cz]} castShadow>
          <boxGeometry args={[largo, 0.06, ancho]} />
          <meshStandardMaterial color={BOX_WHITE} roughness={0.3} />
        </mesh>

        {/* Pared frontal caja (bulkhead) */}
        <mesh position={[0.03, alto / 2, cz]}>
          <boxGeometry args={[0.06, alto, ancho]} />
          <meshStandardMaterial color="#e4e4e7" roughness={0.4} />
        </mesh>

        {/* Pared izquierda: solo marco (corte para ver carga) */}
        <mesh position={[largo / 2, alto / 2, 0]}>
          <boxGeometry args={[largo, alto, 0.04]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.12} depthWrite={false} />
          <Edges color="#94a3b8" />
        </mesh>

        {/* Esquinas caja */}
        <mesh position={[largo / 2, alto / 2, cz]}>
          <boxGeometry args={[largo, alto, ancho]} />
          <meshStandardMaterial visible={false} />
          <Edges color="#71717a" threshold={15} />
        </mesh>

        {/* Rejilla interior */}
        {Array.from({ length: Math.ceil(largo / 0.5) + 1 }, (_, i) => {
          const x = i * 0.5;
          return x <= largo ? (
            <Line key={`gx${i}`} points={[[x, 0.02, 0], [x, 0.02, ancho]]} color="#e2e8f0" lineWidth={0.5} />
          ) : null;
        })}
        {Array.from({ length: Math.ceil(ancho / 0.5) + 1 }, (_, i) => {
          const z = i * 0.5;
          return z <= ancho ? (
            <Line key={`gz${i}`} points={[[0, 0.02, z], [largo, 0.02, z]]} color="#e2e8f0" lineWidth={0.5} />
          ) : null;
        })}
      </group>

      {modeloLabel && (
        <Text
          position={[largo / 2, alto + 0.35, cz]}
          fontSize={0.18}
          color="#52525b"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {modeloLabel}
        </Text>
      )}
    </group>
  );
}

export function CargoBulto({
  bulto,
  dimmed,
  highlighted,
  ghost,
}: {
  bulto: Pick<BultoColocado, 'x' | 'y' | 'z' | 'largo' | 'ancho' | 'alto' | 'color' | 'id'>;
  dimmed: boolean;
  highlighted: boolean;
  ghost?: boolean;
}) {
  const cx = bulto.x + bulto.largo / 2;
  const cy = bulto.y + bulto.alto / 2;
  const cz = bulto.z + bulto.ancho / 2;
  const opacity = ghost ? 0.45 : dimmed ? 0.12 : highlighted ? 1 : 0.95;

  return (
    <RoundedBox
      args={[bulto.largo * 0.96, bulto.alto * 0.96, bulto.ancho * 0.96]}
      radius={0.02}
      smoothness={2}
      position={[cx, cy, cz]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={ghost ? '#fca5a5' : highlighted ? '#ff6b6b' : bulto.color}
        roughness={0.45}
        metalness={ghost ? 0 : 0.06}
        transparent={ghost || dimmed || highlighted}
        opacity={opacity}
      />
    </RoundedBox>
  );
}

/** Bultos sin cupo apilados fuera del camión */
export function UnplacedStack({
  items,
  contenedor,
  tarimaDims,
}: {
  items: BultoNoColocado[];
  contenedor: { largo: number; ancho: number; alto: number };
  tarimaDims: { largo: number; ancho: number; alto: number };
}) {
  const baseX = contenedor.largo + 0.35;
  return (
    <group>
      <Text
        position={[baseX + 0.6, contenedor.alto + 0.2, contenedor.ancho / 2]}
        fontSize={0.14}
        color="#b45309"
        anchorX="center"
      >
        Sin cupo
      </Text>
      {items.map((item, i) => {
        const preset = item.tipo && item.tipo in TIPOS_BULTO ? TIPOS_BULTO[item.tipo as keyof typeof TIPOS_BULTO] : null;
        const largo = item.tipo === 'tarima' ? tarimaDims.largo : preset?.largo ?? 1;
        const ancho = item.tipo === 'tarima' ? tarimaDims.ancho : preset?.ancho ?? 1;
        const alto = item.tipo === 'tarima' ? tarimaDims.alto : preset?.alto ?? 1;
        const col = Math.floor(i / 2);
        const row = i % 2;
        return (
          <CargoBulto
            key={item.id}
            bulto={{
              id: item.id,
              x: baseX + col * (largo + 0.08),
              y: 0,
              z: 0.1 + row * (ancho + 0.08),
              largo,
              ancho,
              alto,
              color: item.color,
            }}
            dimmed={false}
            highlighted={false}
            ghost
          />
        );
      })}
    </group>
  );
}
