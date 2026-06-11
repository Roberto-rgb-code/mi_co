import type { CSSProperties } from 'react';
import type { BultoDims, BultoForma, InventarioItemConfig, TipoBultoPreset } from '../types/cubicaje';
import { bultoVolume } from '../types/cubicaje';

interface Props {
  preset: TipoBultoPreset;
  count: number;
  dims: BultoDims;
  config: InventarioItemConfig;
  onChange: (n: number) => void;
  onDimsChange: (dims: BultoDims) => void;
  onConfigChange: (config: InventarioItemConfig) => void;
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
  forma,
}: {
  dims: BultoDims;
  onDimsChange: (dims: BultoDims) => void;
  compact?: boolean;
  forma: BultoForma;
}) {
  const set = (key: keyof BultoDims, raw: string) => {
    onDimsChange({ ...dims, [key]: parseDim(raw, dims[key]) });
  };

  const setDiameter = (raw: string) => {
    const d = parseDim(raw, dims.largo);
    onDimsChange({ ...dims, largo: d, ancho: d });
  };

  if (forma === 'cilindro') {
    return (
      <div className={`cubicaje-inv-dims ${compact ? 'cubicaje-inv-dims--sm' : ''}`}>
        <span className="cubicaje-inv-dims-label">Medidas (m)</span>
        <label>
          Ø
          <input
            type="number"
            min={0.05}
            step={0.01}
            value={formatDim(dims.largo)}
            onChange={(e) => setDiameter(e.target.value)}
            title="Diámetro"
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
            title="Altura"
          />
        </label>
      </div>
    );
  }

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

function parsePeso(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function MetaEditor({
  config,
  onConfigChange,
  presetLabel,
}: {
  config: InventarioItemConfig;
  onConfigChange: (config: InventarioItemConfig) => void;
  presetLabel: string;
}) {
  return (
    <div className="cubicaje-inv-meta-fields">
      <label className="cubicaje-inv-meta-field cubicaje-inv-meta-field--wide">
        <span>Etiqueta</span>
        <input
          type="text"
          value={config.etiqueta}
          placeholder={presetLabel}
          maxLength={40}
          onChange={(e) => onConfigChange({ ...config, etiqueta: e.target.value })}
        />
      </label>
      <label className="cubicaje-inv-meta-field">
        <span>Peso (kg)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={config.pesoKg}
          onChange={(e) => onConfigChange({ ...config, pesoKg: parsePeso(e.target.value, config.pesoKg) })}
        />
      </label>
    </div>
  );
}

export function CubicajeInventoryCard({
  preset,
  count,
  dims,
  config,
  onChange,
  onDimsChange,
  onConfigChange,
  placed,
  unplaced,
  compact = false,
}: Props) {
  const vol = bultoVolume(dims, preset.forma).toFixed(3);
  const dimLabel =
    preset.forma === 'cilindro'
      ? `Ø${dims.largo} × ${dims.alto} m`
      : `${dims.largo}×${dims.ancho}×${dims.alto} m`;

  if (compact) {
    return (
      <div className="cubicaje-inv-row">
        <span className="cubicaje-inv-dot" style={{ background: preset.color }} />
        <div className="cubicaje-inv-row-info">
          <span className="cubicaje-inv-row-name">{preset.label}</span>
          <span className="cubicaje-inv-row-dim">{dimLabel}</span>
          <DimsEditor dims={dims} onDimsChange={onDimsChange} compact forma={preset.forma} />
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
      <div
        className={`cubicaje-inv-preview ${preset.forma === 'cilindro' ? 'cubicaje-inv-preview--cylinder' : ''}`}
        style={{ '--box-color': preset.color } as CSSProperties}
      >
        <div className={preset.forma === 'cilindro' ? 'cubicaje-inv-cylinder3d' : 'cubicaje-inv-box3d'} />
      </div>
      <div className="cubicaje-inv-body">
        <div className="cubicaje-inv-head">
          <strong>{preset.label}</strong>
          <span className="cubicaje-inv-tag" style={{ background: preset.color }}>
            {dimLabel}
          </span>
        </div>
        <p className="cubicaje-inv-meta">
          Vol. {vol} m³ · {config.pesoKg} kg/u
        </p>
        <MetaEditor config={config} onConfigChange={onConfigChange} presetLabel={preset.label} />
        {(placed != null || unplaced != null) && (
          <p className="cubicaje-inv-status">
            {placed != null && <span className="ok">{placed} colocados</span>}
            {unplaced != null && unplaced > 0 && (
              <span className="warn">{unplaced} sin cupo</span>
            )}
          </p>
        )}
        <DimsEditor dims={dims} onDimsChange={onDimsChange} forma={preset.forma} />
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
