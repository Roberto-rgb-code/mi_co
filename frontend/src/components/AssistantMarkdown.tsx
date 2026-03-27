import type { ReactNode } from 'react';
import './AssistantMarkdown.css';

/**
 * Markdown mínimo: **negrita**, ![alt](url) imágenes, saltos de línea.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className="assistant-md-p">
          <LineWithMarkdown text={line || '\u00a0'} />
        </p>
      ))}
    </>
  );
}

function LineWithMarkdown({ text }: { text: string }) {
  const imgPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = imgPattern.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<LineWithBold key={key++} text={text.slice(last, m.index)} />);
    }
    const alt = m[1];
    const src = m[2];
    parts.push(
      <img
        key={key++}
        src={src}
        alt={alt}
        className="assistant-md-img"
        loading="lazy"
      />,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<LineWithBold key={key++} text={text.slice(last)} />);
  }
  if (parts.length === 0) {
    return <LineWithBold text={text} />;
  }
  return <>{parts}</>;
}

function LineWithBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return <span key={j}>{part}</span>;
      })}
    </>
  );
}
