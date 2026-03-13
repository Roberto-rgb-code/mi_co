import { useState, useEffect } from 'react'
import './App.css'

const API_URL = ''

interface Modelo {
  id: string
  catalogo: string
  familia: string
  precio: string
  capacidadCarga: string
  kmPorLitro: string
}

function App() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Modelo | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/modelos`)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => setModelos(data))
      .catch(() => setError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.'))
      .finally(() => setLoading(false))
  }, [])

  const formatPrice = (n: string) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(n || '0'))

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-text">ISUZU</span>
          <span className="logo-sub">Cotizador</span>
        </div>
        <p className="tagline">Sistema de cotización ELF y Forward</p>
      </header>

      <main className="main">
        <section className="hero">
          <h1>Selecciona tu modelo</h1>
          <p>Explora nuestra línea de camiones Isuzu y cotiza en segundos</p>
        </section>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Cargando catálogo...</p>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <p>{error}</p>
            <p className="hint">Ejecuta: npm run backend</p>
          </div>
        )}

        {!loading && !error && modelos.length === 0 && (
          <div className="empty-state">
            <p>No hay modelos en catálogo aún.</p>
            <p>Ejecuta el seed o importa datos desde Excel.</p>
          </div>
        )}

        {!loading && !error && modelos.length > 0 && (
          <div className="grid">
            {modelos.map(m => (
              <article
                key={m.id}
                className={`card ${selected?.id === m.id ? 'selected' : ''}`}
                onClick={() => setSelected(m)}
              >
                <div className="card-badge">{m.familia}</div>
                <h3>{m.catalogo}</h3>
                <p className="capacity">{m.capacidadCarga || '-'}</p>
                <p className="price">{formatPrice(m.precio)}</p>
                {m.kmPorLitro && (
                  <p className="km">Consumo: {m.kmPorLitro}</p>
                )}
              </article>
            ))}
          </div>
        )}

        {selected && (
          <aside className="sidebar">
            <h3>Cotización seleccionada</h3>
            <div className="selected-detail">
              <strong>{selected.catalogo}</strong>
              <p>{selected.capacidadCarga}</p>
              <p className="precio-final">{formatPrice(selected.precio)}</p>
            </div>
          </aside>
        )}
      </main>

      <footer className="footer">
        <p>© 2026 Isuzu Cotizador · Chasis Cabina</p>
      </footer>
    </div>
  )
}

export default App
