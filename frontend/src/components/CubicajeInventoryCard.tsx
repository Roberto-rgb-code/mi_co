import type { CSSProperties } from 'react';
import type { BultoDims, TipoBultoPreset } from '../types/cubicaje';

interface Props {
  preset: TipoBultoPreset;
  count: number;
  dims: BultoDims;
  onChange: (n: number) => void;
  onDimsChange: (dims: BultoDims) => void;
  placed?: number;
  unplaced?: number;
  compact?: boolean;
}

function parseDim(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0.05 ? n : fallback;
}

function formatDim(n: number): string {
  return Number.isInteger(n * 100) ? n.toFixed(2) : n.toFixed(2);
}

function DimsEditor({
  dims,
  onDimsChange,
  compact,
}: {
  dims: BultoDims;
  onDimsChange: (dims: BultoDims) => void;
  compact?: boolean;
}) {
  const set = (key: keyof BultoDims, raw: string) => {
    onDimsChange({ ...dims, [key]: parseDim(raw, dims[key]) });
  };

  return (
    <div className={`cubicaje-inv-dims ${compact ? 'cubicaje-inv-dims--sm' : ''}`}>
      <span className="cubicaje-inv-dims-label">Medidas (m)</span>
      <label>
        L
        <input
          type="number"
          min={0.05}
          step={0.01}
          value={formatDim(dims.largo)}
          onChange={(e) => set('largo', e.target.value)}
        />
      </label>
      <label>
        A
        <input
          type="number"
          min={0.05}
          step={0.01}
          value={formatDim(dims.ancho)}
          onChange={(e) => set('ancho', e.target.value)}
        />
      </label>
      <label>
        H
        <input
          type="number"
          min={0.05}
          step={0.01}
          value={formatDim(dims.alto)}
          onChange={(e) => set('alto', e.target.value)}
        />
      </label>
    </div>
  );
}

export function CubicajeInventoryCard({
  preset,
  count,
  dims,
  onChange,
  onDimsChange,
  placed,
  unplaced,
  compact = false,
}: Props) {
  const vol = (dims.largo * dims.ancho * dims.alto).toFixed(3);
  const dimLabel = `${dims.largo}×${dims.ancho}×${dims.alto} m`;

  if (compact) {
    return (
      <div className="cubicaje-inv-row">
        <span className="cubicaje-inv-dot" style={{ background: preset.color }} />
        <div className="cubicaje-inv-row-info">
          <span className="cubicaje-inv-row-name">{preset.label}</span>
          <span className="cubicaje-inv-row-dim">{dimLabel}</span>
          <DimsEditor dims={dims} onDimsChange={onDimsChange} compact />
        </div>
        {placed != null && (
          <span className={`cubicaje-inv-row-status ${unplaced ? 'warn' : 'ok'}`}>
            {placed}/{count}
          </span>
        )}
        <div className="cubicaje-inv-qty cubicaje-inv-qty--sm">
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
    );
  }

  return (
    <div className="cubicaje-inv-card">
      <div className="cubicaje-inv-preview" style={{ '--box-color': preset.color } as CSSProperties}>
        <div className="cubicaje-inv-box3d" />
      </div>
      <div className="cubicaje-inv-body">
        <div className="cubicaje-inv-head">
          <strong>{preset.label}</strong>
          <span className="cubicaje-inv-tag" style={{ background: preset.color }}>
            {dimLabel}
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
        <DimsEditor dims={dims} onDimsChange={onDimsChange} />
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
