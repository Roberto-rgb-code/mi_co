import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ClienteDto } from './CRM';
import { CubicajeScene } from '../components/CubicajeScene';
import type { CameraPreset, CubicajeResult } from '../types/cubicaje';
import { CAMERA_PRESETS } from '../types/cubicaje';
import './Cubicaje.css';

interface ModeloOption {
  key: string;
  label: string;
  largo: number;
  ancho: number;
  alto: number;
}

export function Cubicaje() {
  const [searchParams] = useSearchParams();
  const clienteIdParam = searchParams.get('cliente');

  const [clientes, setClientes] = useState<ClienteDto[]>([]);
  const [modelos, setModelos] = useState<ModeloOption[]>([]);
  const [clienteId, setClienteId] = useState(clienteIdParam || '');
  const [modelo, setModelo] = useState('');
  const [cantidad, setCantidad] = useState(8);
  const [tarimaLargo, setTarimaLargo] = useState(1.2);
  const [tarimaAncho, setTarimaAncho] = useState(1.0);
  const [tarimaAlto, setTarimaAlto] = useState(1.5);
  const [pesoKg, setPesoKg] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CubicajeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');

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
      if (c.cantidadTarimas != null && c.cantidadTarimas > 0) setCantidad(c.cantidadTarimas);
      if (c.tarimaLargo != null) setTarimaLargo(Number(c.tarimaLargo));
      if (c.tarimaAncho != null) setTarimaAncho(Number(c.tarimaAncho));
      if (c.tarimaAlto != null) setTarimaAlto(Number(c.tarimaAlto));
      if (c.pesoEstimadoKg != null) setPesoKg(Number(c.pesoEstimadoKg));
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

  const handleCalcular = async () => {
    if (!modelo || cantidad < 1) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/cubicaje/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo,
          pesoEstimadoKg: pesoKg === '' ? undefined : Number(pesoKg),
          bultos: [
            {
              id: 'tarima',
              label: selectedCliente?.productoTransportar
                ? `Tarima (${selectedCliente.productoTransportar})`
                : 'Tarima',
              largo: tarimaLargo,
              ancho: tarimaAncho,
              alto: tarimaAlto,
              cantidad,
              color: '#c8102e',
            },
          ],
        }),
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

  return (
    <div className="page cubicaje">
      <header className="cubicaje-header">
        <div>
          <h1>Cubicaje 3D</h1>
          <p className="cubicaje-lead">
            Visualiza la colocación de tarimas dentro de la caja del camión ISUZU. Selecciona un
            cliente del CRM para precargar datos o ajusta manualmente.
          </p>
        </div>
        {selectedCliente && (
          <Link to={`/crm/${selectedCliente.id}`} className="cubicaje-cliente-link">
            Ver ficha: {selectedCliente.nombre}
          </Link>
        )}
      </header>

      <div className="cubicaje-layout">
        <aside className="cubicaje-panel cubicaje-panel--controls">
          <h2>Configuración</h2>

          <label className="cubicaje-field">
            Cliente (CRM)
            <select
              value={clienteId}
              onChange={(e) => applyCliente(e.target.value)}
            >
              <option value="">— Manual —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.empresa ? ` · ${c.empresa}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="cubicaje-field">
            Modelo ISUZU
            <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
              {modelos.map((m) => (
                <option key={m.key} value={m.label}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {selectedModelo && (
            <p className="cubicaje-dims-hint">
              Caja: {selectedModelo.largo.toFixed(2)} × {selectedModelo.ancho.toFixed(2)} ×{' '}
              {selectedModelo.alto.toFixed(2)} m
            </p>
          )}

          <label className="cubicaje-field">
            Cantidad de tarimas
            <input
              type="number"
              min={1}
              max={200}
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)}
            />
          </label>

          <div className="cubicaje-row">
            <label className="cubicaje-field">
              Largo (m)
              <input
                type="number"
                step={0.01}
                min={0.1}
                value={tarimaLargo}
                onChange={(e) => setTarimaLargo(parseFloat(e.target.value) || 1.2)}
              />
            </label>
            <label className="cubicaje-field">
              Ancho (m)
              <input
                type="number"
                step={0.01}
                min={0.1}
                value={tarimaAncho}
                onChange={(e) => setTarimaAncho(parseFloat(e.target.value) || 1)}
              />
            </label>
            <label className="cubicaje-field">
              Alto (m)
              <input
                type="number"
                step={0.01}
                min={0.1}
                value={tarimaAlto}
                onChange={(e) => setTarimaAlto(parseFloat(e.target.value) || 1.5)}
              />
            </label>
          </div>

          <label className="cubicaje-field">
            Peso estimado total (kg)
            <input
              type="number"
              min={0}
              value={pesoKg}
              placeholder="Opcional"
              onChange={(e) => setPesoKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </label>

          <button
            type="button"
            className="btn-primary cubicaje-calc-btn"
            onClick={() => void handleCalcular()}
            disabled={loading || !modelo}
          >
            {loading ? 'Calculando…' : 'Calcular cubicaje'}
          </button>

          {error && (
            <p className="cubicaje-error" role="alert">
              {error}
            </p>
          )}
        </aside>

        <main className="cubicaje-main">
          <div className="cubicaje-view-toolbar">
            {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`cubicaje-view-btn ${cameraPreset === key ? 'active' : ''}`}
                onClick={() => setCameraPreset(key)}
              >
                {CAMERA_PRESETS[key].label}
              </button>
            ))}
          </div>

          <div className="cubicaje-canvas-wrap">
            {result ? (
              <CubicajeScene result={result} preset={cameraPreset} />
            ) : (
              <div className="cubicaje-canvas-placeholder">
                <span>📦</span>
                <p>Configura los datos y pulsa «Calcular cubicaje» para ver la carga en 3D.</p>
              </div>
            )}
          </div>
        </main>

        <aside className="cubicaje-panel cubicaje-panel--stats">
          <h2>Resultado</h2>
          {!result && <p className="cubicaje-muted">Sin cálculo aún.</p>}
          {result && (
            <>
              <p className={`cubicaje-msg ${result.cabenTodos ? 'ok' : 'warn'}`}>
                {result.mensaje}
              </p>
              <dl className="cubicaje-stats">
                <div>
                  <dt>Modelo</dt>
                  <dd>{result.modelo}</dd>
                </div>
                <div>
                  <dt>Colocados</dt>
                  <dd>
                    {result.totalColocados} / {result.totalSolicitados}
                  </dd>
                </div>
                <div>
                  <dt>Volumen usado</dt>
                  <dd>{result.utilizacionVolumen}%</dd>
                </div>
                {result.pesoMaxKg != null && (
                  <div>
                    <dt>Peso / capacidad</dt>
                    <dd className={result.pesoOk ? '' : 'warn-text'}>
                      {result.pesoEstimadoKg != null
                        ? `${result.pesoEstimadoKg} / ~${Math.round(result.pesoMaxKg)} kg`
                        : `~${Math.round(result.pesoMaxKg)} kg máx.`}
                    </dd>
                  </div>
                )}
              </dl>

              <h3>Bultos colocados</h3>
              <ul className="cubicaje-bultos-list">
                {result.bultos.map((b) => (
                  <li key={b.id}>
                    <span className="cubicaje-swatch" style={{ background: b.color }} />
                    <span>{b.label}</span>
                    <span className="cubicaje-bulto-pos">
                      {b.largo.toFixed(2)}×{b.ancho.toFixed(2)}×{b.alto.toFixed(2)} m
                    </span>
                  </li>
                ))}
              </ul>
              {result.noCabe > 0 && (
                <p className="cubicaje-warn-inline">{result.noCabe} bulto(s) no cupieron.</p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
