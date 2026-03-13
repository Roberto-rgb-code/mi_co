import type { ModeloCatalog } from '../data/catalog';
import './ModeloDetalle.css';

interface Props {
  modelo: ModeloCatalog;
  onClose: () => void;
}

export function ModeloDetalle({ modelo, onClose }: Props) {
  const precio = modelo.precio ?? modelo.precio_2026;
  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

  const imageUrl = modelo.image || `https://placehold.co/600x380/f5f6f8/e5e7eb?text=${encodeURIComponent(modelo.modelo)}`;

  return (
    <div className="modelo-detalle-overlay" onClick={onClose}>
      <div className="modelo-detalle" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modelo-detalle-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
        <div className="modelo-detalle-header">
          <div className="modelo-detalle-image">
            <img src={imageUrl} alt={modelo.modelo} />
          </div>
          <div className="modelo-detalle-info">
            <span className="badge">{modelo.linea || 'ISUZU'}</span>
            <h1>{modelo.modelo}</h1>
            {modelo.capacidad_carga && <p className="capacidad">{modelo.capacidad_carga}</p>}
            {precio && <p className="precio">{formatPrice(precio)}</p>}
          </div>
        </div>
        <div className="modelo-detalle-specs">
          <h3>Motor</h3>
          <p>{modelo.motor || '-'}</p>

          <h3>Tecnología</h3>
          <p>{modelo.tecnologia || '-'}</p>

          <h3>Potencia / Torque</h3>
          <p>{modelo.hp && modelo.torque ? `${modelo.hp} · ${modelo.torque}` : '-'}</p>

          <h3>Consumo</h3>
          <p>{modelo.km_litro || modelo.distancia_consumo?.rendimiento_promedio_km_litro ? `${modelo.distancia_consumo?.rendimiento_promedio_km_litro} km/L` : '-'}</p>

          <h3>Garantía</h3>
          <p>{modelo.garantia || '-'}</p>

          <h3>Frenos</h3>
          <p>{modelo.frenos || modelo.distancia_consumo?.frenos_tipo_rin || '-'}</p>

          <h3>Dimensiones (m)</h3>
          <p>
            Largo: {modelo.largo_chasis ?? '-'} · Alto: {modelo.alto_camion ?? '-'} · Ancho: {modelo.ancho_cabina ?? '-'}
          </p>

          <h3>Área de carga (m)</h3>
          <p>
            Largo: {modelo.largo_aplicacion ?? '-'} · Alto: {modelo.alto_aplicacion ?? '-'} · Ancho: {modelo.ancho_aplicacion ?? '-'}
          </p>

          <h3>Llantas</h3>
          <p>{modelo.llantas || '-'}</p>

          {modelo.equipo && (
            <>
              <h3>Equipo estándar</h3>
              <p>{modelo.equipo}</p>
            </>
          )}

          {modelo.distancia_consumo && (
            <>
              <h3>Tanque y autonomía</h3>
              <p>
                {modelo.distancia_consumo.capacidad_tanque_litros} L · ~{modelo.distancia_consumo.distancia_promedio_km} km con tanque lleno
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
