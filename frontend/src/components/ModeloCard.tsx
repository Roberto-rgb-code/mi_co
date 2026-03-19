import type { ModeloCatalog } from '../data/catalog';
import './ModeloCard.css';

interface Props {
  modelo: ModeloCatalog;
  onClick?: () => void;
  /** Catálogo: motor + km + precio. Cotizador: precio destacado (hoja DATOS 2 / cotización). */
  variant?: 'catalog' | 'cotizador';
  selected?: boolean;
}

export function ModeloCard({ modelo, onClick, variant = 'catalog', selected = false }: Props) {
  const precio = modelo.precio ?? modelo.precio_2026;
  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

  const imageUrl = modelo.image || `https://placehold.co/400x260/f5f6f8/e5e7eb?text=${encodeURIComponent(modelo.modelo)}`;
  const motorShort = modelo.motor?.split(' ').slice(0, 4).join(' ') || null;

  const cardClass = [
    'modelo-card',
    variant === 'cotizador' ? 'modelo-card--cotizador' : '',
    selected ? 'modelo-card--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={cardClass}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Seleccionar modelo ${modelo.modelo}` : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="modelo-card-image">
        <img src={imageUrl} alt={modelo.modelo} />
        <span className="modelo-card-badge">{modelo.linea || 'ISUZU'}</span>
      </div>
      <div className="modelo-card-body">
        <h3>{modelo.modelo}</h3>
        <p className="capacidad">{modelo.capacidad_carga || '-'}</p>
        {variant === 'catalog' && (
          <>
            <p className="especs">{motorShort || '-'}</p>
            {modelo.km_litro && <p className="km">{modelo.km_litro}</p>}
            {precio && <p className="precio">{formatPrice(precio)}</p>}
          </>
        )}
        {variant === 'cotizador' && (
          <>
            {motorShort && <p className="especs especs--muted">{motorShort}</p>}
            {precio && <p className="precio precio--hero">{formatPrice(precio)}</p>}
            {modelo.km_litro && <p className="km km--footer">{modelo.km_litro}</p>}
          </>
        )}
      </div>
    </article>
  );
}
