import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ClienteDto } from './CRM';
import { CubicajeScene, CubicajeSceneFromResult } from '../components/CubicajeScene';
import { CubicajeInventoryCard } from '../components/CubicajeInventoryCard';
import type { CameraPreset, CubicajeResult, InventarioCounts } from '../types/cubicaje';
import { CAMERA_PRESETS, TIPOS_BULTO, inventarioToBultos } from '../types/cubicaje';
import './Cubicaje.css';

interface ModeloOption {
  key: string;
  label: string;
  largo: number;
  ancho: number;
  alto: number;
  linea?: string;
}

const DEFAULT_INVENTARIO: InventarioCounts = {
  pequena: 0,
  mediana: 0,
  grande: 0,
  tarima: 8,
};

export function Cubicaje() {
  const [searchParams] = useSearchParams();
  const clienteIdParam = searchParams.get('cliente');

  const [clientes, setClientes] = useState<ClienteDto[]>([]);
  const [modelos, setModelos] = useState<ModeloOption[]>([]);
  const [clienteId, setClienteId] = useState(clienteIdParam || '');
  const [modelo, setModelo] = useState('');
  const [inventario, setInventario] = useState<InventarioCounts>(DEFAULT_INVENTARIO);
  const [tarimaLargo, setTarimaLargo] = useState(1.2);
  const [tarimaAncho, setTarimaAncho] = useState(1.0);
  const [tarimaAlto, setTarimaAlto] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CubicajeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('side');
  const [filaFilter, setFilaFilter] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch('/catalog_data.json')
        .then((r) => (r.ok ? r.json() : { modelos: {} }))
        .catch(() => ({ modelos: {} })),
    ]).then(([clientesData, catalog]) => {
      setClientes(Array.isArray(clientesData) ? clientesData : []);
      const obj = (catalog as { modelos?: Record<string, Record<string, unknown>> }).modelos || {};
      const list: ModeloOption[] = Object.entries(obj).map(([key, val]) => ({
        key,
        label: (val.modelo as string) || key,
        largo: (val.largo_aplicacion as number) ?? 6,
        ancho: (val.ancho_aplicacion as number) ?? 2.2,
        alto: (val.alto_aplicacion as number) ?? 2.2,
        linea: val.linea as string | undefined,
      }));
      list.sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
      setModelos(list);
      if (list.length > 0 && !modelo) setModelo(list[0].label);
    });
  }, []);

  const applyCliente = useCallback(
    (id: string) => {
      setClienteId(id);
      if (!id) return;
      const c = clientes.find((x) => x.id === id);
      if (!c) return;
      if (c.modeloRecomendado) setModelo(c.modeloRecomendado);
      if (c.tarimaLargo != null) setTarimaLargo(Number(c.tarimaLargo));
      if (c.tarimaAncho != null) setTarimaAncho(Number(c.tarimaAncho));
      if (c.tarimaAlto != null) setTarimaAlto(Number(c.tarimaAlto));
      setInventario((prev) => ({
        ...prev,
        tarima: c.cantidadTarimas != null && c.cantidadTarimas > 0 ? c.cantidadTarimas : prev.tarima,
      }));
    },
    [clientes],
  );

  useEffect(() => {
    if (clienteIdParam && clientes.length > 0) applyCliente(clienteIdParam);
  }, [clienteIdParam, clientes, applyCliente]);

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === clienteId),
    [clientes, clienteId],
  );

  const selectedModelo = useMemo(
    () => modelos.find((m) => m.label === modelo || m.key === modelo),
    [modelos, modelo],
  );

  const previewContenedor = useMemo(
    () =>
      selectedModelo
        ? { largo: selectedModelo.largo, ancho: selectedModelo.ancho, alto: selectedModelo.alto }
        : null,
    [selectedModelo],
  );

  const totalBultos = inventario.pequena + inventario.mediana + inventario.grande + inventario.tarima;

  const statsByTipo = useMemo(() => {
    if (!result) return {};
    const map: Record<string, { placed: number; unplaced: number }> = {};
    result.bultos.forEach((b) => {
      const t = b.tipo || 'custom';
      map[t] = map[t] || { placed: 0, unplaced: 0 };
      map[t].placed++;
    });
    result.noColocados.forEach((b) => {
      const t = b.tipo || 'custom';
      map[t] = map[t] || { placed: 0, unplaced: 0 };
      map[t].unplaced++;
    });
    return map;
  }, [result]);

  const handleCalcular = async () => {
    if (!modelo || totalBultos < 1) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFilaFilter(null);
    setHighlightedId(null);
    try {
      const bultos = inventarioToBultos(
        inventario,
        { largo: tarimaLargo, ancho: tarimaAncho, alto: tarimaAlto },
        selectedCliente?.productoTransportar,
      );
      const res = await fetch('/api/cubicaje/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo, bultos }),
      });
      const data = (await res.json()) as CubicajeResult & { message?: string };
      if (!res.ok) throw new Error(data.message || 'Error al calcular cubicaje');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al calcular');
    } finally {
      setLoading(false);
    }
  };

  const setInv = (key: keyof InventarioCounts, n: number) => {
    setInventario((prev) => ({ ...prev, [key]: n }));
  };

  const filaButtons = useMemo(() => {
    if (!result || result.filas < 1) return [];
    return Array.from({ length: Math.min(result.filas, 4) }, (_, i) => i + 1);
  }, [result]);

  return (
    <div className="page cubicaje cubicaje-dashboard">
      <header className="cubicaje-topbar">
        <div className="cubicaje-brand">
          <span className="cubicaje-brand-logo">ISUZU</span>
          <span className="cubicaje-brand-sub">Cubicaje de carga</span>
        </div>
        <div className="cubicaje-topbar-center">
          <label className="cubicaje-cliente-select">
            <span>Cliente CRM</span>
            <select value={clienteId} onChange={(e) => applyCliente(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.productoTransportar ? ` · ${c.productoTransportar}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedCliente && (
          <Link to={`/crm/${selectedCliente.id}`} className="cubicaje-cliente-link">
            Ficha cliente
          </Link>
        )}
      </header>

      <div className="cubicaje-dashboard-grid">
        {/* Columna izquierda: selector de camión */}
        <aside className="cubicaje-trucks">
          <h2>Camiones ISUZU</h2>
          <ul className="cubicaje-truck-list">
            {modelos.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  className={`cubicaje-truck-item ${modelo === m.label ? 'active' : ''}`}
                  onClick={() => {
                    setModelo(m.label);
                    setResult(null);
                  }}
                >
                  <span className="cubicaje-truck-icon" aria-hidden>
                    <svg viewBox="0 0 48 32" width="36" height="24">
                      <rect x="2" y="10" width="14" height="14" rx="2" fill={modelo === m.label ? '#c8102e' : '#3f3f46'} />
                      <rect x="16" y="8" width="30" height="16" rx="1" fill={modelo === m.label ? '#e4e4e7' : '#d4d4d8'} stroke="#a1a1aa" />
                      <circle cx="10" cy="26" r="3" fill="#27272a" />
                      <circle cx="38" cy="26" r="3" fill="#27272a" />
                    </svg>
                  </span>
                  <span className="cubicaje-truck-info">
                    <strong>{m.label}</strong>
                    <small>
                      {m.largo.toFixed(1)}×{m.ancho.toFixed(1)}×{m.alto.toFixed(1)} m
                      {m.linea ? ` · ${m.linea}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Centro: visualización 3D */}
        <main className="cubicaje-stage">
          <div className="cubicaje-stage-toolbar">
            <div className="cubicaje-view-tabs">
              {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`cubicaje-view-tab ${cameraPreset === key ? 'active' : ''}`}
                  onClick={() => setCameraPreset(key)}
                >
                  {CAMERA_PRESETS[key].label}
                </button>
              ))}
            </div>
            {filaButtons.length > 0 && (
              <div className="cubicaje-row-tabs">
                <button
                  type="button"
                  className={`cubicaje-row-tab ${filaFilter === null ? 'active' : ''}`}
                  onClick={() => setFilaFilter(null)}
                >
                  Todas
                </button>
                {filaButtons.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`cubicaje-row-tab ${filaFilter === f ? 'active' : ''}`}
                    onClick={() => setFilaFilter(f === filaFilter ? null : f)}
                  >
                    Fila {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="cubicaje-canvas-wrap">
            {previewContenedor ? (
              <>
                {result ? (
                  <CubicajeSceneFromResult
                    result={result}
                    tarimaDims={{ largo: tarimaLargo, ancho: tarimaAncho, alto: tarimaAlto }}
                    preset={cameraPreset}
                    filaFilter={filaFilter}
                    highlightedId={highlightedId}
                  />
                ) : (
                  <CubicajeScene
                    contenedor={previewContenedor}
                    modeloLabel={modelo}
                    preset={cameraPreset}
                  />
                )}
                {loading && (
                  <div className="cubicaje-canvas-loading">
                    <div className="spinner" />
                    <span>Calculando cubicaje…</span>
                  </div>
                )}
                <div className="cubicaje-canvas-hint">
                  Arrastra para rotar · Rueda para zoom
                </div>
              </>
            ) : (
              <div className="cubicaje-canvas-placeholder">
                <span>🚛</span>
                <p>Cargando catálogo de camiones…</p>
              </div>
            )}
          </div>

          {(result || previewContenedor) && (
            <footer className="cubicaje-metrics-bar">
              {result ? (
                <>
                  <div className="cubicaje-metric">
                    <span className="cubicaje-metric-label">Peso</span>
                    <strong className={result.pesoOk ? '' : 'warn'}>
                      {Math.round(result.pesoColocadoKg)} kg
                      {result.pesoMaxKg != null && ` / ~${Math.round(result.pesoMaxKg)} kg`}
                    </strong>
                  </div>
                  <div className="cubicaje-metric">
                    <span className="cubicaje-metric-label">Volumen</span>
                    <strong>{result.utilizacionVolumen}%</strong>
                  </div>
                  <div className="cubicaje-metric">
                    <span className="cubicaje-metric-label">Colocados</span>
                    <strong>
                      {result.totalColocados}/{result.totalSolicitados}
                    </strong>
                  </div>
                  <div className="cubicaje-metric cubicaje-metric--msg">
                    <span className={result.cabenTodos ? 'ok' : 'warn'}>{result.mensaje}</span>
                  </div>
                </>
              ) : (
                <div className="cubicaje-metric cubicaje-metric--msg">
                  <span className="cubicaje-muted-inline">
                    {modelo} · Caja {previewContenedor!.largo.toFixed(2)}×
                    {previewContenedor!.ancho.toFixed(2)}×{previewContenedor!.alto.toFixed(2)} m — Pulsa
                    «Optimizar carga» para simular.
                  </span>
                </div>
              )}
            </footer>
          )}
        </main>

        {/* Columna derecha: inventario de carga */}
        <aside className="cubicaje-inventory">
          <div className="cubicaje-inventory-head">
            <h2>Carga a colocar</h2>
            <button
              type="button"
              className="btn-primary cubicaje-optimize-btn"
              onClick={() => void handleCalcular()}
              disabled={loading || !modelo || totalBultos < 1}
            >
              {loading ? 'Optimizando…' : 'Optimizar carga'}
            </button>
          </div>

          {(['pequena', 'mediana', 'grande', 'tarima'] as const).map((tipo) => (
            <CubicajeInventoryCard
              key={tipo}
              preset={TIPOS_BULTO[tipo]}
              count={inventario[tipo]}
              onChange={(n) => setInv(tipo, n)}
              placed={statsByTipo[tipo]?.placed}
              unplaced={statsByTipo[tipo]?.unplaced}
            />
          ))}

          {inventario.tarima > 0 && (
            <div className="cubicaje-tarima-dims">
              <p className="cubicaje-dims-title">Dimensiones tarima (m)</p>
              <div className="cubicaje-row">
                <label>
                  L
                  <input
                    type="number"
                    step={0.01}
                    value={tarimaLargo}
                    onChange={(e) => setTarimaLargo(parseFloat(e.target.value) || 1.2)}
                  />
                </label>
                <label>
                  A
                  <input
                    type="number"
                    step={0.01}
                    value={tarimaAncho}
                    onChange={(e) => setTarimaAncho(parseFloat(e.target.value) || 1)}
                  />
                </label>
                <label>
                  H
                  <input
                    type="number"
                    step={0.01}
                    value={tarimaAlto}
                    onChange={(e) => setTarimaAlto(parseFloat(e.target.value) || 1.5)}
                  />
                </label>
              </div>
            </div>
          )}

          {error && (
            <p className="cubicaje-error" role="alert">
              {error}
            </p>
          )}

          {result && result.noColocados.length > 0 && (
            <div className="cubicaje-unplaced">
              <h3>Sin cupo ({result.noColocados.length})</h3>
              <ul>
                {result.noColocados.map((b) => (
                  <li key={b.id}>
                    <span className="cubicaje-swatch" style={{ background: b.color }} />
                    {b.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result && result.bultos.length > 0 && (
            <div className="cubicaje-placed-list">
              <h3>Colocados ({result.bultos.length})</h3>
              <ul>
                {result.bultos.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={highlightedId === b.id ? 'active' : ''}
                      onClick={() => setHighlightedId(highlightedId === b.id ? null : b.id)}
                    >
                      <span className="cubicaje-swatch" style={{ background: b.color }} />
                      <span>{b.label}</span>
                      <span className="cubicaje-bulto-pos">F{b.fila}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
