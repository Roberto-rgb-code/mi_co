import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AssistantMarkdown } from '../components/AssistantMarkdown';
import './Asistente.css';

type Role = 'user' | 'assistant';

interface Msg {
  role: Role;
  content: string;
}

const WELCOME: Msg = {
  role: 'assistant',
  content:
    '¡Hola! Soy el asistente de **ISUZU Cotizador**. Puedo orientarte según **qué producto o material vas a cargar**, la **carga** (toneladas), **tipo de caja** (caja seca, redilas, plataforma… con imagen de referencia), **presupuesto** y ruta.\n\nCuéntame qué transportarás y te sugiero modelo del catálogo y cómo acomodar la carga. Para **precios exactos** usa el **Cotizador** o el **Catálogo**.',
};

export function Asistente() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; message?: string; statusCode?: number };
      if (!res.ok) {
        const msg =
          typeof data.message === 'string'
            ? data.message
            : res.status === 503
              ? 'El asistente no está configurado (falta API key en el servidor) o el servicio no respondió.'
              : 'No se pudo obtener respuesta. Intenta de nuevo.';
        throw new Error(msg);
      }
      if (!data.reply) throw new Error('Respuesta vacía.');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page asistente">
      <div className="asistente-header">
        <div>
          <h1>Asistente</h1>
          <p className="asistente-sub">
            Recomendaciones según peso, precio, giro y uso. Los datos del catálogo orientan al modelo; precios exactos en{' '}
            <Link to="/cotizador">Cotizador</Link> y <Link to="/catalogo">Catálogo</Link>.
          </p>
        </div>
        <div className="asistente-chips">
          <span className="chip">Carga / tonelaje</span>
          <span className="chip">Presupuesto</span>
          <span className="chip">Tipo de negocio</span>
          <span className="chip">Ruta y distancia</span>
        </div>
      </div>

      {error && (
        <div className="asistente-error" role="alert">
          {error}
        </div>
      )}

      <div className="asistente-chat" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`asistente-bubble asistente-bubble--${m.role}`}>
            <span className="asistente-bubble-label">{m.role === 'user' ? 'Tú' : 'Asistente'}</span>
            <div className="asistente-bubble-text">
              {m.role === 'assistant' ? <AssistantMarkdown text={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="asistente-bubble asistente-bubble--assistant asistente-typing">
            <span className="asistente-bubble-label">Asistente</span>
            <span className="dots" aria-hidden="true">
              <span /> <span /> <span />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="asistente-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="asistente-textarea"
          rows={2}
          placeholder="Ej.: Necesito un camión para 3 toneladas en ciudad, presupuesto hasta 1.2 MMXN, reparto de abarrotes…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={loading}
          aria-label="Escribe tu mensaje"
        />
        <button type="submit" className="asistente-send" disabled={loading || !input.trim()}>
          {loading ? '…' : 'Enviar'}
        </button>
      </form>

      <p className="asistente-footnote">
        El servidor envía al modelo un resumen y el catálogo compacto desde <code>catalog_data.json</code>, más
        detalle de los modelos que mejor encajan con tu pregunta. Las respuestas no sustituyen asesoría comercial.{' '}
        <code>OPENAI_MODEL</code> por defecto <code>gpt-4o-mini</code>.
      </p>
    </div>
  );
}
