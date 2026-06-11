import { Edges, Html, Line } from '@react-three/drei';
import { useMemo } from 'react';

function fmtM(n: number): string {
  return `${n.toFixed(2)} m`;
}

/** Rejilla y etiquetas L/A/H sobre el volumen exacto de carga [0…largo]×[0…alto]×[0…ancho] (metros). */
export function CargoDimensionGuides({
  largo,
  ancho,
  alto,
}: {
  largo: number;
  ancho: number;
  alto: number;
}) {
  const step = useMemo(() => {
    const maxDim = Math.max(largo, ancho, alto);
    if (maxDim <= 4) return 0.5;
    return 1;
  }, [largo, ancho, alto]);

  const gridSegments = useMemo(() => {
    const segs: [[number, number, number], [number, number, number]][] = [];
    for (let x = 0; x <= largo + 0.001; x += step) {
      segs.push([
        [x, 0.012, 0],
        [x, 0.012, ancho],
      ]);
    }
    for (let z = 0; z <= ancho + 0.001; z += step) {
      segs.push([
        [0, 0.012, z],
        [largo, 0.012, z],
      ]);
    }
    return segs;
  }, [largo, ancho, alto, step]);

  const cx = largo / 2;
  const cy = alto / 2;
  const cz = ancho / 2;

  return (
    <group>
      {gridSegments.map((pts, i) => (
        <Line
          key={`grid-${i}`}
          points={pts}
          color="#94a3b8"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}

      <mesh position={[cx, cy, cz]}>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#c8102e" threshold={15} />
      </mesh>

      <Html position={[cx, 0.04, -0.22]} center style={{ pointerEvents: 'none' }} zIndexRange={[50, 0]}>
        <span className="cubicaje-dim-tag">L {fmtM(largo)}</span>
      </Html>
      <Html position={[-0.22, cy, cz]} center style={{ pointerEvents: 'none' }} zIndexRange={[50, 0]}>
        <span className="cubicaje-dim-tag">H {fmtM(alto)}</span>
      </Html>
      <Html position={[cx, cy, ancho + 0.22]} center style={{ pointerEvents: 'none' }} zIndexRange={[50, 0]}>
        <span className="cubicaje-dim-tag">A {fmtM(ancho)}</span>
      </Html>
    </group>
  );
}
