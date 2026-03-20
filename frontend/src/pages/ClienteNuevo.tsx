import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { ClienteDto } from './CRM';
import './CRM.css';

const emptyCliente: Partial<ClienteDto> = {
  nombre: '',
  email: '',
  telefono: '',
  empresa: '',
  productoTransportar: '',
  cantidadTarimas: 0,
  tarimaLargo: 1.2,
  tarimaAncho: 1,
  tarimaAlto: 1.5,
  pesoEstimadoKg: undefined,
  requerimientos: '',
  modeloRecomendado: '',
  notaNecesidades: '',
};

export function ClienteNuevo() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<ClienteDto>>(emptyCliente);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.email || saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
          telefono: form.telefono || undefined,
          empresa: form.empresa || undefined,
          productoTransportar: form.productoTransportar || undefined,
          cantidadTarimas: form.cantidadTarimas ?? 0,
          tarimaLargo: form.tarimaLargo,
          tarimaAncho: form.tarimaAncho,
          tarimaAlto: form.tarimaAlto,
          pesoEstimadoKg: form.pesoEstimadoKg,
          requerimientos: form.requerimientos || undefined,
          notaNecesidades: form.notaNecesidades || undefined,
        }),
      });
      if (!res.ok) throw new Error('Error al crear');
      const data = (await res.json()) as ClienteDto;
      navigate(`/crm/${data.id}`);
    } catch {
      setError('No se pudo crear el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page crm crm-nuevo">
      <div className="crm-nuevo-header">
        <Link to="/crm" className="crm-back">
          ← CRM
        </Link>
        <h1>Nuevo cliente</h1>
        <p className="crm-sub">Captura los datos y necesidades. Luego el asistente recomendará con argumentos.</p>
      </div>

      {error && (
        <div className="crm-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="crm-form crm-form--nuevo">
        <label>
          Nombre *
          <input
            value={form.nombre || ''}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            placeholder="Juan Pérez"
          />
        </label>
        <label>
          Email *
          <input
            type="email"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="juan@empresa.com"
          />
        </label>
        <label>
          Teléfono
          <input
            value={form.telefono || ''}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="55 1234 5678"
          />
        </label>
        <label>
          Empresa
          <input
            value={form.empresa || ''}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            placeholder="Distribuidora de frutas S.A."
          />
        </label>
        <label>
          Producto a transportar
          <input
            value={form.productoTransportar || ''}
            onChange={(e) => setForm({ ...form, productoTransportar: e.target.value })}
            placeholder="Peras, abarrotes, materiales de construcción..."
          />
        </label>
        <label>
          Cantidad de tarimas
          <input
            type="number"
            min={0}
            value={form.cantidadTarimas ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                cantidadTarimas: e.target.value ? parseInt(e.target.value, 10) : 0,
              })
            }
          />
        </label>
        <div className="crm-form-row">
          <label>
            Largo tarima (m)
            <input
              type="number"
              step={0.01}
              value={form.tarimaLargo ?? 1.2}
              onChange={(e) =>
                setForm({ ...form, tarimaLargo: e.target.value ? parseFloat(e.target.value) : 1.2 })
              }
            />
          </label>
          <label>
            Ancho tarima (m)
            <input
              type="number"
              step={0.01}
              value={form.tarimaAncho ?? 1}
              onChange={(e) =>
                setForm({ ...form, tarimaAncho: e.target.value ? parseFloat(e.target.value) : 1 })
              }
            />
          </label>
        </div>
        <label>
          Requerimientos especiales
          <input
            value={form.requerimientos || ''}
            onChange={(e) => setForm({ ...form, requerimientos: e.target.value })}
            placeholder="Refrigerado, grúa, puerta lateral..."
          />
        </label>
        <label>
          Notas / necesidades
          <textarea
            value={form.notaNecesidades || ''}
            onChange={(e) => setForm({ ...form, notaNecesidades: e.target.value })}
            rows={3}
            placeholder="Descripción de uso, rutas, frecuencia..."
          />
        </label>
        <div className="crm-form-actions">
          <Link to="/crm" className="btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
