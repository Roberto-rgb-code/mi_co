import type { ModeloCatalog } from '../data/catalog';
import './ModeloCard.css';

interface Props {
  modelo: ModeloCatalog;
  onClick?: () => void;
}

export function ModeloCard({ modelo, onClick }: Props) {
  const precio = modelo.precio ?? modelo.precio_2026;
  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

  const imageUrl = modelo.image || `https://placehold.co/400x260/f5f6f8/e5e7eb?text=${encodeURIComponent(modelo.modelo)}`;

  return (
    <article className="modelo-card" onClick={onClick}>
      <div className="modelo-card-image">
        <img src={imageUrl} alt={modelo.modelo} />
        <span className="modelo-card-badge">{modelo.linea || 'ISUZU'}</span>
      </div>
      <div className="modelo-card-body">
        <h3>{modelo.modelo}</h3>
        <p className="capacidad">{modelo.capacidad_carga || '-'}</p>
        <p className="especs">{modelo.motor?.split(' ').slice(0, 4).join(' ') || '-'}</p>
        {modelo.km_litro && <p className="km">{modelo.km_litro}</p>}
        {precio && <p className="precio">{formatPrice(precio)}</p>}
      </div>
    </article>
  );
}
