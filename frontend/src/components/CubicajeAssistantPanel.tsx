import { useEffect, useRef, useState } from 'react';
import { AssistantMarkdown } from './AssistantMarkdown';
import type { CubicajeAsistenteResponse } from '../types/cubicaje';

type Role = 'user' | 'assistant';

interface Msg {
  role: Role;
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  modeloActual: string;
  modelosDisponibles: string[];
  clientContext?: string;
  onApply: (result: CubicajeAsistenteResponse) => void | Promise<void>;
}

const WELCOME: Msg = {
  role: 'assistant',
  content:
    'Describe la mercancía en lenguaje natural: cantidades, medidas (m o cm), peso por unidad y nombre del producto.\n\n**Ejemplo:** «8 tarimas de 1.2×1×1.5 m, 700 kg cada una, producto aceite» o «12 tambos de 200 litros, 180 kg, químicos».\n\nConfiguro el inventario y puedo simular la carga en el camión automáticamente.',
};

export function CubicajeAssistantPanel({
  open,
  onClose,
  modeloActual,
  modelosDisponibles,
  clientContext,
  onApply,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
      const res = await fetch('/api/cubicaje/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          modeloActual,
          modelosDisponibles,
          clientContext,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CubicajeAsistenteResponse & {
        message?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : 'No se pudo contactar al asistente. Verifica OPENAI_API_KEY en el servidor.',
        );
      }
      if (!data.reply) throw new Error('Respuesta vacía.');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
      if (data.aplicar && data.items?.length) {
        await onApply(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="cubicaje-ai-overlay" role="presentation" onClick={onClose}>
      <aside
        className="cubicaje-ai-panel"
        role="dialog"
        aria-labelledby="cubicaje-ai-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cubicaje-ai-header">
          <div>
            <h2 id="cubicaje-ai-title">Asistente IA · Carga</h2>
            <p className="cubicaje-ai-sub">
              Camión: <strong>{modeloActual || '—'}</strong>
            </p>
          </div>
          <button type="button" className="cubicaje-ai-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {error && (
          <div className="cubicaje-ai-error" role="alert">
            {error}
          </div>
        )}

        <div className="cubicaje-ai-chat" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`cubicaje-ai-bubble cubicaje-ai-bubble--${m.role}`}>
              <span className="cubicaje-ai-bubble-label">{m.role === 'user' ? 'Tú' : 'Asistente'}</span>
              <div className="cubicaje-ai-bubble-text">
                {m.role === 'assistant' ? <AssistantMarkdown text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="cubicaje-ai-bubble cubicaje-ai-bubble--assistant cubicaje-ai-typing">
              <span className="cubicaje-ai-bubble-label">Asistente</span>
              <span className="dots" aria-hidden="true">
                <span /> <span /> <span />
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="cubicaje-ai-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            className="cubicaje-ai-textarea"
            rows={3}
            placeholder="Ej.: 6 tarimas 1.2×1×1.5 m, 650 kg, etiqueta Refacciones…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={loading}
            aria-label="Describe la mercancía"
          />
          <button type="submit" className="cubicaje-ai-send" disabled={loading || !input.trim()}>
            {loading ? '…' : 'Enviar'}
          </button>
        </form>
      </aside>
    </div>
  );
}
