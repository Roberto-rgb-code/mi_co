import type { CSSProperties } from 'react';
import type { TipoBultoPreset } from '../types/cubicaje';

interface Props {
  preset: TipoBultoPreset;
  count: number;
  onChange: (n: number) => void;
  placed?: number;
  unplaced?: number;
}

/** Tarjeta de inventario (estilo panel derecho XPO / CLOA). */
export function CubicajeInventoryCard({ preset, count, onChange, placed, unplaced }: Props) {
  const vol = (preset.largo * preset.ancho * preset.alto).toFixed(3);

  return (
    <div className="cubicaje-inv-card">
      <div className="cubicaje-inv-preview" style={{ '--box-color': preset.color } as CSSProperties}>
        <div className="cubicaje-inv-box3d" />
      </div>
      <div className="cubicaje-inv-body">
        <div className="cubicaje-inv-head">
          <strong>{preset.label}</strong>
          <span className="cubicaje-inv-tag" style={{ background: preset.color }}>
            {preset.largo}×{preset.ancho}×{preset.alto} m
          </span>
        </div>
        <p className="cubicaje-inv-meta">
          Vol. {vol} m³ · ~{preset.pesoKg} kg/u
        </p>
        {(placed != null || unplaced != null) && (
          <p className="cubicaje-inv-status">
            {placed != null && <span className="ok">{placed} colocados</span>}
            {unplaced != null && unplaced > 0 && (
              <span className="warn">{unplaced} sin cupo</span>
            )}
          </p>
        )}
        <div className="cubicaje-inv-qty">
          <button type="button" onClick={() => onChange(Math.max(0, count - 1))} aria-label="Menos">
            −
          </button>
          <input
            type="number"
            min={0}
            max={999}
            value={count}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
          <button type="button" onClick={() => onChange(count + 1)} aria-label="Más">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
