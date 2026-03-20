import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { ClienteDto } from './CRM';
import './CRM.css';

type Role = 'user' | 'assistant';

interface Msg {
  role: Role;
  content: string;
}

function LineWithBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </>
  );
}

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i}>
          <LineWithBold text={line || '\u00a0'} />
        </p>
      ))}
    </>
  );
}

export function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<ClienteDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distribucion, setDistribucion] = useState<{ svg: string; mensaje: string; cabenTodas: boolean } | null>(null);
  const [distribucionLoading, setDistribucionLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/clientes/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCliente)
      .catch(() => setCliente(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (cliente && messages.length === 0) {
      const ctx = [
        cliente.nombre && `Cliente: ${cliente.nombre}`,
        cliente.empresa && `Empresa: ${cliente.empresa}`,
        cliente.productoTransportar && `Producto: ${cliente.productoTransportar}`,
        cliente.cantidadTarimas && `Tarimas: ${cliente.cantidadTarimas}`,
        cliente.requerimientos && `Requerimientos: ${cliente.requerimientos}`,
        cliente.notaNecesidades && `Necesidades: ${cliente.notaNecesidades}`,
      ]
        .filter(Boolean)
        .join('. ');
      setMessages([
        {
          role: 'assistant',
          content: `Hola, estoy viendo los datos de **${cliente.nombre}**${cliente.productoTransportar ? ` (${cliente.productoTransportar})` : ''}. ${ctx ? 'Con base en la información capturada, puedo recomendarte modelos y distribución de carga. ¿Qué te gustaría saber?' : 'Cuéntame qué necesitas y te ayudo a elegir el camión adecuado.'}`,
        },
      ]);
    }
  }, [cliente, messages.length]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente || !id || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      });
      if (!res.ok) throw new Error('Error al guardar');
    } catch {
      //
    } finally {
      setSaving(false);
    }
  };

  const handleGenerarDistribucion = async () => {
    if (!cliente || !cliente.modeloRecomendado || !cliente.cantidadTarimas) return;
    setDistribucionLoading(true);
    setDistribucion(null);
    try {
      const res = await fetch('/api/clientes/distribucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo: cliente.modeloRecomendado,
          cantidadTarimas: cliente.cantidadTarimas,
          tarimaLargo: cliente.tarimaLargo ?? 1.2,
          tarimaAncho: cliente.tarimaAncho ?? 1.0,
          tarimaAlto: cliente.tarimaAlto ?? 1.5,
        }),
      });
      const data = await res.json();
      if (data.svg) setDistribucion({ svg: data.svg, mensaje: data.mensaje || '', cabenTodas: data.cabenTodas });
    } catch {
      setDistribucion({ svg: '', mensaje: 'Error al generar distribución', cabenTodas: false });
    } finally {
      setDistribucionLoading(false);
    }
  };

  const sendChat = async () => {
    const text = input.trim();
    if (!text || chatLoading || !cliente) return;
    setChatError(null);
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setChatLoading(true);

    const clientContext = [
      `Cliente: ${cliente.nombre}`,
      cliente.empresa && `Empresa: ${cliente.empresa}`,
      cliente.productoTransportar && `Producto: ${cliente.productoTransportar}`,
      cliente.cantidadTarimas && `Tarimas: ${cliente.cantidadTarimas}`,
      cliente.tarimaLargo && cliente.tarimaAncho &&
        `Dimensiones tarima: ${cliente.tarimaLargo}m x ${cliente.tarimaAncho}m`,
      cliente.requerimientos && `Requerimientos: ${cliente.requerimientos}`,
      cliente.notaNecesidades && `Necesidades: ${cliente.notaNecesidades}`,
    ]
      .filter(Boolean)
      .join('. ');

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, clientContext }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; message?: string };
      if (!res.ok) throw new Error(data.message || 'Error');
      if (data.reply) setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Error');
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading || !id) {
    return (
      <div className="page crm">
        <div className="crm-loading">
          <div className="spinner" />
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="page crm">
        <p>Cliente no encontrado.</p>
        <Link to="/crm">Volver al CRM</Link>
      </div>
    );
  }

  return (
    <div className="page crm crm-detalle">
      <div className="crm-detalle-header">
        <Link to="/crm" className="crm-back">
          ← CRM
        </Link>
        <h1>{cliente.nombre}</h1>
      </div>

      <div className="crm-detalle-grid">
        <section className="crm-form-section">
          <h2>Datos del cliente</h2>
          <form onSubmit={handleSave} className="crm-form">
            <label>
              Nombre
              <input
                value={cliente.nombre}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={cliente.email}
                onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                required
              />
            </label>
            <label>
              Teléfono
              <input
                value={cliente.telefono || ''}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
              />
            </label>
            <label>
              Empresa
              <input
                value={cliente.empresa || ''}
                onChange={(e) => setCliente({ ...cliente, empresa: e.target.value })}
              />
            </label>
            <label>
              Producto a transportar (ej. peras, abarrotes)
              <input
                value={cliente.productoTransportar || ''}
                onChange={(e) => setCliente({ ...cliente, productoTransportar: e.target.value })}
                placeholder="Peras, materiales, refrigerados..."
              />
            </label>
            <label>
              Cantidad de tarimas
              <input
                type="number"
                min={0}
                value={cliente.cantidadTarimas ?? ''}
                onChange={(e) =>
                  setCliente({
                    ...cliente,
                    cantidadTarimas: e.target.value ? parseInt(e.target.value, 10) : undefined,
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
                  value={cliente.tarimaLargo ?? 1.2}
                  onChange={(e) =>
                    setCliente({ ...cliente, tarimaLargo: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                />
              </label>
              <label>
                Ancho tarima (m)
                <input
                  type="number"
                  step={0.01}
                  value={cliente.tarimaAncho ?? 1}
                  onChange={(e) =>
                    setCliente({ ...cliente, tarimaAncho: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                />
              </label>
            </div>
            <label>
              Requerimientos (refrigerado, grúa, etc.)
              <input
                value={cliente.requerimientos || ''}
                onChange={(e) => setCliente({ ...cliente, requerimientos: e.target.value })}
              />
            </label>
            <label>
              Modelo recomendado
              <input
                value={cliente.modeloRecomendado || ''}
                onChange={(e) => setCliente({ ...cliente, modeloRecomendado: e.target.value })}
                placeholder="ELF 500K, FORWARD 800K..."
              />
            </label>
            <label>
              Notas / necesidades
              <textarea
                value={cliente.notaNecesidades || ''}
                onChange={(e) => setCliente({ ...cliente, notaNecesidades: e.target.value })}
                rows={3}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </section>

        <section className="crm-chat-section">
          <h2>Asistente con contexto del cliente</h2>
          <p className="crm-chat-sub">
            Recomendaciones basadas en producto, tarimas y requerimientos.
          </p>
          {chatError && (
            <div className="crm-chat-error" role="alert">
              {chatError}
            </div>
          )}
          <div className="crm-chat">
            {messages.map((m, i) => (
              <div key={i} className={`crm-bubble crm-bubble--${m.role}`}>
                <span className="crm-bubble-label">{m.role === 'user' ? 'Tú' : 'Asistente'}</span>
                <div className="crm-bubble-text">
                  {m.role === 'assistant' ? <AssistantMarkdown text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="crm-bubble crm-bubble--assistant crm-typing">
                <span className="dots">
                  <span /> <span /> <span />
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="crm-chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat();
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
              placeholder="Pregunta por modelos, distribución, recomendaciones..."
              disabled={chatLoading}
              rows={2}
            />
            <button type="submit" disabled={chatLoading || !input.trim()}>
              Enviar
            </button>
          </form>
        </section>

        <section className="crm-distribucion-section">
          <h2>Distribución de tarimas</h2>
          <p className="crm-dist-sub">
            Genera la vista de cómo quedarían las tarimas en el camión recomendado.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleGenerarDistribucion}
            disabled={
              distribucionLoading || !cliente.modeloRecomendado || !cliente.cantidadTarimas
            }
          >
            {distribucionLoading ? 'Generando…' : 'Generar distribución'}
          </button>
          {distribucion && (
            <div className="crm-dist-result">
              <p className={distribucion.cabenTodas ? 'crm-dist-ok' : 'crm-dist-warn'}>
                {distribucion.mensaje}
              </p>
              {distribucion.svg && (
                <div
                  className="crm-dist-svg"
                  dangerouslySetInnerHTML={{ __html: distribucion.svg }}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
