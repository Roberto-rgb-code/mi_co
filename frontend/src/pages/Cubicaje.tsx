import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ClienteDto } from './CRM';
import { CubicajeScene, CubicajeSceneFromResult } from '../components/CubicajeScene';
import { CubicajeInventoryCard } from '../components/CubicajeInventoryCard';
import type { CameraPreset, CubicajeResult, InventarioCounts } from '../types/cubicaje';
import { CAMERA_PRESETS, TIPOS_BULTO, inventarioToBultos } from '../types/cubicaje';
import { calcMetrosVacios, calcVolumenUsado } from '../utils/cubicajeAxleWeight';
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
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [filaFilter, setFilaFilter] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [truckSearch, setTruckSearch] = useState('');
  const [showPlacedList, setShowPlacedList] = useState(false);
  const [showWeight, setShowWeight] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [viewResetKey, setViewResetKey] = useState(0);

  const setCameraView = (preset: CameraPreset) => {
    setCameraPreset(preset);
    setZoomFactor(1);
    setViewResetKey((k) => k + 1);
  };

  const zoomIn = () => setZoomFactor((z) => Math.min(3, z * 1.2));
  const zoomOut = () => setZoomFactor((z) => Math.max(0.35, z / 1.2));
  const resetView = () => {
    setZoomFactor(1);
    setViewResetKey((k) => k + 1);
  };

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

  const handleCalcular = async (modeloOverride?: string) => {
    const targetModelo = modeloOverride ?? modelo;
    if (!targetModelo || totalBultos < 1) return;
    if (modeloOverride) setModelo(modeloOverride);
    setLoading(true);
    setError(null);
    if (!modeloOverride) {
      setResult(null);
      setFilaFilter(null);
      setHighlightedId(null);
    }
    try {
      const bultos = inventarioToBultos(
        inventario,
        { largo: tarimaLargo, ancho: tarimaAncho, alto: tarimaAlto },
        selectedCliente?.productoTransportar,
      );
      const res = await fetch('/api/cubicaje/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo: targetModelo, bultos }),
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

  const filteredModelos = useMemo(() => {
    const q = truckSearch.trim().toLowerCase();
    if (!q) return modelos;
    return modelos.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        (m.linea && m.linea.toLowerCase().includes(q)),
    );
  }, [modelos, truckSearch]);

  const espacioLibre = result
    ? Math.max(0, 100 - result.utilizacionVolumen)
    : null;

  const volStats = useMemo(() => {
    if (!previewContenedor) return null;
    const total = previewContenedor.largo * previewContenedor.ancho * previewContenedor.alto;
    const used = result ? calcVolumenUsado(result.bultos) : 0;
    return { total: Math.round(total * 100) / 100, used };
  }, [previewContenedor, result]);

  const metrosVacios = result
    ? calcMetrosVacios(result.bultos, result.contenedor.largo)
    : previewContenedor?.largo ?? 0;

  const GROUP_LETTERS = ['A', 'B', 'C', 'D'] as const;

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
          {result ? (
            <>
              <h2>Grupos</h2>
              <ul className="cubicaje-group-list">
                {(['pequena', 'mediana', 'grande', 'tarima'] as const).map((tipo, idx) => {
                  const total = inventario[tipo];
                  if (total === 0) return null;
                  const placed = statsByTipo[tipo]?.placed ?? 0;
                  const preset = TIPOS_BULTO[tipo];
                  return (
                    <li key={tipo} className="cubicaje-group-item">
                      <span className="cubicaje-group-badge" style={{ background: preset.color }}>
                        {GROUP_LETTERS[idx]}
                      </span>
                      <span className="cubicaje-group-name">{preset.label}</span>
                      <span className={`cubicaje-group-count ${placed === total ? 'ok' : 'warn'}`}>
                        {placed}/{total}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <h2 className="cubicaje-trucks-sub">Camión</h2>
            </>
          ) : (
            <h2>Flota ISUZU</h2>
          )}
          <input
            type="search"
            className="cubicaje-truck-search"
            placeholder="Buscar modelo…"
            value={truckSearch}
            onChange={(e) => setTruckSearch(e.target.value)}
          />
          <ul className="cubicaje-truck-list">
            {filteredModelos.map((m) => (
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
          <div className="cubicaje-vehicle-bar">
            <div className="cubicaje-vehicle-info">
              <h2 className="cubicaje-stage-title">{modelo || 'Selecciona un camión'}</h2>
              {previewContenedor && (
                <p className="cubicaje-vehicle-dims">
                  {(previewContenedor.largo * 100).toFixed(1)} ×{' '}
                  {(previewContenedor.ancho * 100).toFixed(1)} ×{' '}
                  {(previewContenedor.alto * 100).toFixed(1)} cm
                </p>
              )}
            </div>
            <table className="cubicaje-stats-table">
              <thead>
                <tr>
                  <th>Peso</th>
                  <th>Volumen</th>
                  <th>Metros vacíos</th>
                  <th>Colocados</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {result ? (
                      <>
                        <strong className={result.pesoOk ? '' : 'warn'}>
                          {Math.round(result.pesoColocadoKg).toLocaleString('es-MX')}
                        </strong>
                        {result.pesoMaxKg != null && (
                          <span className="cubicaje-stat-max">
                            {' '}
                            / {Math.round(result.pesoMaxKg).toLocaleString('es-MX')} kg
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {volStats ? (
                      <>
                        <strong>{volStats.used}</strong>
                        <span className="cubicaje-stat-max"> / {volStats.total} m³</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <strong>{metrosVacios.toFixed(2)}</strong> m
                  </td>
                  <td>
                    {result ? (
                      <strong>
                        {result.totalColocados}/{result.totalSolicitados}
                      </strong>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="cubicaje-canvas-wrap">
            {previewContenedor ? (
              <>
                {result ? (
                  <CubicajeSceneFromResult
                    result={result}
                    preset={cameraPreset}
                    filaFilter={filaFilter}
                    highlightedId={highlightedId}
                    showWeight={showWeight}
                    showLabels={showLabels}
                    zoomFactor={zoomFactor}
                    viewResetKey={viewResetKey}
                  />
                ) : (
                  <CubicajeScene
                    contenedor={previewContenedor}
                    modeloLabel={modelo}
                    preset={cameraPreset}
                    showWeight={false}
                    showLabels={false}
                    zoomFactor={zoomFactor}
                    viewResetKey={viewResetKey}
                  />
                )}
                {loading && (
                  <div className="cubicaje-canvas-loading">
                    <div className="spinner" />
                    <span>Calculando cubicaje…</span>
                  </div>
                )}
                <aside className="cubicaje-view-rail" aria-label="Controles de vista">
                  <p className="cubicaje-view-rail-title">Vistas</p>
                  {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`cubicaje-view-icon ${cameraPreset === key ? 'active' : ''}`}
                      onClick={() => setCameraView(key)}
                      title={CAMERA_PRESETS[key].label}
                    >
                      {key === 'side' && (
                        <svg viewBox="0 0 24 24" width="22" height="22">
                          <rect x="2" y="8" width="20" height="10" rx="1" fill="currentColor" opacity="0.3" />
                          <rect x="2" y="8" width="6" height="8" rx="1" fill="currentColor" />
                        </svg>
                      )}
                      {key === 'top' && (
                        <svg viewBox="0 0 24 24" width="22" height="22">
                          <rect x="4" y="4" width="16" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
                          <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" />
                          <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                      {key === 'iso' && (
                        <svg viewBox="0 0 24 24" width="22" height="22">
                          <path d="M4 18 L12 6 L20 18 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                          <rect x="8" y="14" width="8" height="4" fill="currentColor" opacity="0.4" />
                        </svg>
                      )}
                      <span>{CAMERA_PRESETS[key].label}</span>
                    </button>
                  ))}
                  <p className="cubicaje-view-rail-title">Opciones</p>
                  <label className="cubicaje-view-toggle">
                    <input
                      type="checkbox"
                      checked={showWeight}
                      onChange={(e) => setShowWeight(e.target.checked)}
                    />
                    Peso en ejes
                  </label>
                  <label className="cubicaje-view-toggle">
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                    />
                    Etiquetas
                  </label>
                  <p className="cubicaje-view-rail-title">Zoom</p>
                  <div className="cubicaje-zoom-row">
                    <button type="button" className="cubicaje-zoom-btn" onClick={zoomOut} title="Alejar">
                      −
                    </button>
                    <button type="button" className="cubicaje-zoom-btn" onClick={resetView} title="Restablecer vista">
                      ⟲
                    </button>
                    <button type="button" className="cubicaje-zoom-btn" onClick={zoomIn} title="Acercar">
                      +
                    </button>
                  </div>
                </aside>
                <p className="cubicaje-canvas-hint">
                  Rueda del ratón: zoom · Arrastrar: girar · Clic derecho: mover
                </p>
                <p className="cubicaje-disclaimer">La carga real puede variar ligeramente</p>
              </>
            ) : (
              <div className="cubicaje-canvas-placeholder">
                <span>🚛</span>
                <p>Cargando catálogo de camiones…</p>
              </div>
            )}
          </div>

          {filaButtons.length > 0 && (
            <div className="cubicaje-row-tabs-bar">
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

          {(result || previewContenedor) && (
            <footer className="cubicaje-metrics-bar">
              {result ? (
                <>
                  <div className="cubicaje-metric">
                    <span className="cubicaje-metric-label">Ocupación volumétrica</span>
                    <strong>{result.utilizacionVolumen}%</strong>
                  </div>
                  {espacioLibre != null && (
                    <div className="cubicaje-metric">
                      <span className="cubicaje-metric-label">Espacio libre</span>
                      <strong>{espacioLibre}%</strong>
                    </div>
                  )}
                  <div className="cubicaje-metric cubicaje-metric--msg">
                    <span className={result.cabenTodos ? 'ok' : 'warn'}>{result.mensaje}</span>
                    {result.modeloSugerido && result.sugerencia && (
                      <div className="cubicaje-suggestion">
                        <p>{result.sugerencia}</p>
                        <button
                          type="button"
                          className="btn-secondary cubicaje-suggestion-btn"
                          onClick={() => void handleCalcular(result.modeloSugerido)}
                          disabled={loading}
                        >
                          Usar {result.modeloSugerido}
                        </button>
                      </div>
                    )}
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
              className="btn-primary cubicaje-optimize-btn cubicaje-load-btn"
              onClick={() => void handleCalcular()}
              disabled={loading || !modelo || totalBultos < 1}
            >
              {loading ? 'Cargando…' : 'Cargar'}
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
              <button
                type="button"
                className="cubicaje-placed-toggle"
                onClick={() => setShowPlacedList((v) => !v)}
              >
                <h3>Colocados ({result.bultos.length})</h3>
                <span>{showPlacedList ? '▲' : '▼'}</span>
              </button>
              {showPlacedList && (
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
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
