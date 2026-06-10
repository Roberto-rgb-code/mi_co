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
      resetView();
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

  const volStats = useMemo(() => {
    if (!previewContenedor) return null;
    const total = previewContenedor.largo * previewContenedor.ancho * previewContenedor.alto;
    const used = result ? calcVolumenUsado(result.bultos) : 0;
    return { total: Math.round(total * 100) / 100, used };
  }, [previewContenedor, result]);

  const metrosVacios = result
    ? calcMetrosVacios(result.bultos, result.contenedor.largo)
    : previewContenedor?.largo ?? 0;

  const onModeloChange = (label: string) => {
    setModelo(label);
    setResult(null);
    resetView();
  };

  return (
    <div className="page cubicaje cubicaje-app">
      <header className="cubicaje-toolbar">
        <div className="cubicaje-toolbar-left">
          <span className="cubicaje-brand-logo">Cubicaje</span>
          <label className="cubicaje-field cubicaje-field--model">
            <span>Modelo ISUZU</span>
            <select value={modelo} onChange={(e) => onModeloChange(e.target.value)}>
              {modelos.map((m) => (
                <option key={m.key} value={m.label}>
                  {m.label} — {m.largo.toFixed(1)}×{m.ancho.toFixed(1)}×{m.alto.toFixed(1)} m
                </option>
              ))}
            </select>
          </label>
          {previewContenedor && (
            <span className="cubicaje-dims-chip">
              {(previewContenedor.largo * 100).toFixed(0)}×{(previewContenedor.ancho * 100).toFixed(0)}×
              {(previewContenedor.alto * 100).toFixed(0)} cm
            </span>
          )}
        </div>

        <div className="cubicaje-toolbar-stats">
          <div className="cubicaje-stat-chip">
            <span>Peso</span>
            <strong className={result && !result.pesoOk ? 'warn' : ''}>
              {result ? Math.round(result.pesoColocadoKg).toLocaleString('es-MX') : '—'}
              {result?.pesoMaxKg != null && (
                <small> / {Math.round(result.pesoMaxKg).toLocaleString('es-MX')}</small>
              )}
            </strong>
          </div>
          <div className="cubicaje-stat-chip">
            <span>Volumen</span>
            <strong>
              {volStats ? `${volStats.used}` : '—'}
              {volStats && <small> / {volStats.total} m³</small>}
            </strong>
          </div>
          <div className="cubicaje-stat-chip">
            <span>Libres</span>
            <strong>{metrosVacios.toFixed(2)} m</strong>
          </div>
          <div className="cubicaje-stat-chip">
            <span>Colocados</span>
            <strong>
              {result ? `${result.totalColocados}/${result.totalSolicitados}` : '—'}
            </strong>
          </div>
          {result && (
            <div className="cubicaje-stat-chip">
              <span>Ocupación</span>
              <strong>{result.utilizacionVolumen}%</strong>
            </div>
          )}
        </div>

        <div className="cubicaje-toolbar-right">
          <label className="cubicaje-field">
            <span>Cliente</span>
            <select value={clienteId} onChange={(e) => applyCliente(e.target.value)}>
              <option value="">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          {selectedCliente && (
            <Link to={`/crm/${selectedCliente.id}`} className="cubicaje-link-btn">
              CRM
            </Link>
          )}
          <button
            type="button"
            className="btn-primary cubicaje-cargar-btn"
            onClick={() => void handleCalcular()}
            disabled={loading || !modelo || totalBultos < 1}
          >
            {loading ? 'Calculando…' : 'Cargar'}
          </button>
        </div>
      </header>

      {result && (
        <div className="cubicaje-result-bar">
          <span className={result.cabenTodos ? 'ok' : 'warn'}>{result.mensaje}</span>
          {result.modeloSugerido && result.sugerencia && (
            <button
              type="button"
              className="cubicaje-suggest-btn"
              onClick={() => void handleCalcular(result.modeloSugerido)}
              disabled={loading}
            >
              Probar {result.modeloSugerido}
            </button>
          )}
          {result.noColocados.length > 0 && (
            <span className="cubicaje-unplaced-chip">
              {result.noColocados.length} sin cupo
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="cubicaje-error-banner" role="alert">
          {error}
        </p>
      )}

      <div className="cubicaje-main">
        <section className="cubicaje-viewport">
          <div className="cubicaje-canvas-wrap">
            {previewContenedor ? (
              <>
                {result ? (
                  <CubicajeSceneFromResult
                    result={result}
                    preset={cameraPreset}
                    filaFilter={filaFilter}
                    showLabels={showLabels}
                    zoomFactor={zoomFactor}
                    viewResetKey={viewResetKey}
                  />
                ) : (
                  <CubicajeScene
                    contenedor={previewContenedor}
                    preset={cameraPreset}
                    showLabels={false}
                    zoomFactor={zoomFactor}
                    viewResetKey={viewResetKey}
                  />
                )}
                {loading && (
                  <div className="cubicaje-canvas-loading">
                    <div className="spinner" />
                    <span>Calculando…</span>
                  </div>
                )}
              </>
            ) : (
              <div className="cubicaje-canvas-placeholder">
                <p>Cargando catálogo…</p>
              </div>
            )}
          </div>

          <footer className="cubicaje-view-footer">
            <div className="cubicaje-view-tabs">
              {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={cameraPreset === key ? 'active' : ''}
                  onClick={() => setCameraView(key)}
                >
                  {CAMERA_PRESETS[key].label}
                </button>
              ))}
            </div>
            {filaButtons.length > 0 && (
              <div className="cubicaje-view-tabs cubicaje-fila-tabs">
                {filaButtons.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={filaFilter === f ? 'active' : ''}
                    onClick={() => setFilaFilter(f === filaFilter ? null : f)}
                  >
                    Fila {f}
                  </button>
                ))}
                <button
                  type="button"
                  className={filaFilter === null ? 'active' : ''}
                  onClick={() => setFilaFilter(null)}
                >
                  Todas
                </button>
              </div>
            )}
            <div className="cubicaje-view-actions">
              <label className="cubicaje-check">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                Etiquetas
              </label>
              <button type="button" onClick={zoomOut} title="Alejar">
                −
              </button>
              <button type="button" onClick={resetView} title="Restablecer">
                ⟲
              </button>
              <button type="button" onClick={zoomIn} title="Acercar">
                +
              </button>
            </div>
          </footer>
        </section>

        <aside className="cubicaje-sidebar">
          <h2 className="cubicaje-sidebar-title">Inventario</h2>
          <div className="cubicaje-inv-list">
            {(['pequena', 'mediana', 'grande', 'tarima'] as const).map((tipo) => (
              <CubicajeInventoryCard
                key={tipo}
                compact
                preset={TIPOS_BULTO[tipo]}
                count={inventario[tipo]}
                onChange={(n) => setInv(tipo, n)}
                placed={statsByTipo[tipo]?.placed}
                unplaced={statsByTipo[tipo]?.unplaced}
              />
            ))}
          </div>

          {inventario.tarima > 0 && (
            <div className="cubicaje-tarima-inline">
              <span className="cubicaje-tarima-label">Tarima (m)</span>
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
          )}

          {!result && previewContenedor && (
            <p className="cubicaje-sidebar-hint">
              Configura cantidades y pulsa <strong>Cargar</strong> para simular la colocación dentro
              de la caja {previewContenedor.largo.toFixed(1)}×{previewContenedor.ancho.toFixed(1)}×
              {previewContenedor.alto.toFixed(1)} m.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
