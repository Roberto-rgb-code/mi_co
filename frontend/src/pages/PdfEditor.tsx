import { useCallback, useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import './PdfEditor.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type CropRect = { x: number; y: number; w: number; h: number };

type PageEdit = {
  rotation: 0 | 90 | 180 | 270;
  /** Recorte normalizado 0–1 sobre la página rotada. */
  crop: CropRect | null;
  /** Si true, la INE recortada se coloca grande centrada en hoja carta. */
  fillPage: boolean;
};

const DEFAULT_EDIT: PageEdit = { rotation: 0, crop: null, fillPage: false };

/** Hoja carta en puntos PDF (72 dpi). */
const LETTER_W = 612;
const LETTER_H = 792;
/** Tope de píxeles por lado al exportar (evita congelar el navegador). */
const MAX_EXPORT_PX = 1600;
const DETECT_SCALE = 1.25;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function yieldUi() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

/** Detecta el rectángulo del contenido (INE) vs fondo blanco/gris claro. */
function detectContentCrop(canvas: HTMLCanvasElement): CropRect | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width: W, height: H } = canvas;
  if (W < 8 || H < 8) return null;

  const data = ctx.getImageData(0, 0, W, H).data;
  const threshold = 245; // casi blanco
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  // Muestreo cada 2 px para ir rápido
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < threshold || g < threshold || b < threshold) {
        hits++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (hits < 80) return null;

  // Padding ~2%
  const padX = Math.max(4, Math.round(W * 0.02));
  const padY = Math.max(4, Math.round(H * 0.02));
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(W - 1, maxX + padX);
  maxY = Math.min(H - 1, maxY + padY);

  const w = (maxX - minX) / W;
  const h = (maxY - minY) / H;
  // Si casi es toda la página, no hay mucho que recortar
  if (w > 0.96 && h > 0.96) return null;
  if (w < 0.05 || h < 0.05) return null;

  return {
    x: minX / W,
    y: minY / H,
    w,
    h,
  };
}

async function renderPageToCanvas(
  page: PDFPageProxy,
  rotation: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale, rotation });
  let w = Math.floor(viewport.width);
  let h = Math.floor(viewport.height);
  const maxSide = Math.max(w, h);
  let usedScale = scale;
  if (maxSide > MAX_EXPORT_PX) {
    usedScale = scale * (MAX_EXPORT_PX / maxSide);
    const vp2 = page.getViewport({ scale: usedScale, rotation });
    w = Math.floor(vp2.width);
    h = Math.floor(vp2.height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const vp = page.getViewport({ scale: usedScale, rotation });
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  return canvas;
}

/** Compone la página final: INE grande en hoja blanca (o página completa). */
function composeOutputCanvas(
  source: HTMLCanvasElement,
  edit: PageEdit,
): HTMLCanvasElement {
  const crop = edit.crop;
  let sx = 0;
  let sy = 0;
  let sw = source.width;
  let sh = source.height;

  if (crop && crop.w > 0.01 && crop.h > 0.01) {
    sx = Math.floor(crop.x * source.width);
    sy = Math.floor(crop.y * source.height);
    sw = Math.max(1, Math.floor(crop.w * source.width));
    sh = Math.max(1, Math.floor(crop.h * source.height));
  }

  if (edit.fillPage || crop) {
    // Hoja carta a buena resolución (cap)
    const dpi = 150;
    const pageW = Math.min(MAX_EXPORT_PX, Math.round((LETTER_W / 72) * dpi));
    const pageH = Math.min(MAX_EXPORT_PX, Math.round((LETTER_H / 72) * dpi));
    const out = document.createElement('canvas');
    out.width = pageW;
    out.height = pageH;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);

    const margin = 0.04;
    const boxW = pageW * (1 - 2 * margin);
    const boxH = pageH * (1 - 2 * margin);
    const scale = Math.min(boxW / sw, boxH / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (pageW - dw) / 2;
    const dy = (pageH - dh) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    return out;
  }

  // Sin recorte ni fill: página completa, limitada
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  return out;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.88): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la imagen'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      quality,
    );
  });
}

export function PdfEditor() {
  const [fileName, setFileName] = useState('');
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [edits, setEdits] = useState<Record<number, PageEdit>>({});
  const [previewZoom, setPreviewZoom] = useState(1);
  const [cropMode, setCropMode] = useState(false);
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Vista del resultado (INE grande) vs página original. */
  const [showResult, setShowResult] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceBytesRef = useRef<ArrayBuffer | null>(null);
  const renderToken = useRef(0);

  const edit = edits[pageIndex] ?? DEFAULT_EDIT;

  const setPageEdit = useCallback((idx: number, patch: Partial<PageEdit>) => {
    setEdits((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? DEFAULT_EDIT), ...patch },
    }));
  }, []);

  const resetDoc = useCallback(() => {
    setPdf(null);
    setPageCount(0);
    setPageIndex(0);
    setEdits({});
    setDraftCrop(null);
    setCropMode(false);
    setFileName('');
    sourceBytesRef.current = null;
    setError(null);
    setShowResult(false);
    setExportProgress('');
  }, []);

  const loadFile = async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se admiten archivos PDF.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      sourceBytesRef.current = buf.slice(0);
      const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      setPdf(doc);
      setPageCount(doc.numPages);
      setPageIndex(0);
      setEdits({});
      setFileName(file.name);
      setPreviewZoom(1);
      setCropMode(false);
      setDraftCrop(null);
      setShowResult(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el PDF.');
      resetDoc();
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void loadFile(f);
  };

  /** Preview: original con overlay, o resultado compuesto. */
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const token = ++renderToken.current;
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageIndex + 1);
      if (cancelled || token !== renderToken.current) return;

      const maxW = Math.min(880, (wrapRef.current?.clientWidth ?? 800) - 24);
      const base = page.getViewport({ scale: 1, rotation: edit.rotation });
      const fit = maxW / base.width;
      const scale = Math.min(2.2, fit * previewZoom);

      const source = await renderPageToCanvas(page, edit.rotation, scale);
      if (cancelled || token !== renderToken.current) return;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (showResult && (edit.crop || edit.fillPage)) {
        const composed = composeOutputCanvas(source, { ...edit, fillPage: true });
        // Encajar preview
        const previewMax = maxW;
        const s = Math.min(1, previewMax / composed.width);
        canvas.width = Math.floor(composed.width * s);
        canvas.height = Math.floor(composed.height * s);
        ctx.fillStyle = '#e8ecf1';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(composed, 0, 0, canvas.width, canvas.height);
        return;
      }

      canvas.width = source.width;
      canvas.height = source.height;
      ctx.drawImage(source, 0, 0);

      const crop = draftCrop ?? edit.crop;
      if (crop) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cx = crop.x * canvas.width;
        const cy = crop.y * canvas.height;
        const cw = crop.w * canvas.width;
        const ch = crop.h * canvas.height;
        ctx.clearRect(cx, cy, cw, ch);
        ctx.drawImage(source, cx, cy, cw, ch, cx, cy, cw, ch);
        ctx.strokeStyle = '#c8102e';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cw, ch);
        ctx.restore();
      }
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Error al renderizar');
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, pageIndex, edit.rotation, edit.crop, edit.fillPage, draftCrop, previewZoom, showResult]);

  const canvasPoint = (e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || showResult) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cropMode || showResult) return;
    const p = canvasPoint(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(p);
    setDraftCrop({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!cropMode || !dragging) return;
    const p = canvasPoint(e);
    if (!p) return;
    setDraftCrop({
      x: Math.min(dragging.x, p.x),
      y: Math.min(dragging.y, p.y),
      w: Math.abs(p.x - dragging.x),
      h: Math.abs(p.y - dragging.y),
    });
  };

  const onPointerUp = () => {
    if (!cropMode || !dragging || !draftCrop) {
      setDragging(null);
      return;
    }
    setDragging(null);
    if (draftCrop.w > 0.02 && draftCrop.h > 0.02) {
      setPageEdit(pageIndex, { crop: draftCrop, fillPage: true });
      setShowResult(true);
      setCropMode(false);
    }
    setDraftCrop(null);
  };

  /** Detecta la INE y la agranda en la hoja (sin llamar a OpenAI: análisis de imagen). */
  const amplifyIne = async () => {
    if (!pdf) return;
    setDetecting(true);
    setError(null);
    setCropMode(false);
    try {
      const page = await pdf.getPage(pageIndex + 1);
      await yieldUi();
      const source = await renderPageToCanvas(page, edit.rotation, DETECT_SCALE);
      await yieldUi();
      const crop = detectContentCrop(source);
      if (!crop) {
        setError(
          'No pude detectar la INE automáticamente. Usa «Recortar» y marca la tarjeta a mano.',
        );
        return;
      }
      setPageEdit(pageIndex, { crop, fillPage: true });
      setShowResult(true);
      setPreviewZoom(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al ampliar la INE');
    } finally {
      setDetecting(false);
    }
  };

  const downloadEdited = async () => {
    if (!pdf) return;
    setExporting(true);
    setError(null);
    setExportProgress('Preparando…');
    try {
      const outPdf = await PDFDocument.create();

      for (let i = 0; i < pageCount; i++) {
        setExportProgress(`Página ${i + 1} de ${pageCount}…`);
        await yieldUi();

        const e = edits[i] ?? DEFAULT_EDIT;
        const page = await pdf.getPage(i + 1);
        // Escala moderada fija — el tamaño final lo define composeOutputCanvas
        const source = await renderPageToCanvas(page, e.rotation, 1.5);
        await yieldUi();

        const composed = composeOutputCanvas(source, {
          ...e,
          // Si hay crop, siempre llenar hoja al exportar
          fillPage: e.fillPage || Boolean(e.crop),
        });
        await yieldUi();

        const bytes = await canvasToJpegBytes(composed, 0.88);
        const jpg = await outPdf.embedJpg(bytes);

        if (e.fillPage || e.crop) {
          const pdfPage = outPdf.addPage([LETTER_W, LETTER_H]);
          pdfPage.drawImage(jpg, {
            x: 0,
            y: 0,
            width: LETTER_W,
            height: LETTER_H,
          });
        } else {
          const scale = Math.min(LETTER_W / composed.width, LETTER_H / composed.height);
          const w = composed.width * scale;
          const h = composed.height * scale;
          const pdfPage = outPdf.addPage([LETTER_W, LETTER_H]);
          pdfPage.drawImage(jpg, {
            x: (LETTER_W - w) / 2,
            y: (LETTER_H - h) / 2,
            width: w,
            height: h,
          });
        }
      }

      setExportProgress('Guardando archivo…');
      await yieldUi();
      const pdfBytes = await outPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = fileName.replace(/\.pdf$/i, '') || 'documento';
      a.href = url;
      a.download = `${base}-ampliado.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar PDF');
    } finally {
      setExporting(false);
      setExportProgress('');
    }
  };

  return (
    <div className="page pdf-editor" data-tour="pdf-root">
      <header className="pdf-editor-header" data-tour="pdf-header">
        <div>
          <h1>Editor de PDF</h1>
          <p className="pdf-editor-sub">
            Detecta la INE en el escaneo, la agranda en la hoja y descarga el PDF. El zoom solo
            acerca la vista; usa <strong>Ampliar INE</strong> para el documento.
          </p>
        </div>
        <div className="pdf-editor-header-actions">
          {pdf && (
            <button
              type="button"
              className="btn-primary"
              data-tour="pdf-download"
              disabled={exporting || detecting}
              onClick={() => void downloadEdited()}
            >
              {exporting ? exportProgress || 'Generando…' : 'Descargar PDF'}
            </button>
          )}
          {pdf && (
            <button type="button" className="pdf-btn-ghost" onClick={resetDoc} disabled={exporting}>
              Nuevo archivo
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="pdf-editor-error" role="alert">
          {error}
        </p>
      )}

      {!pdf && (
        <div
          className="pdf-dropzone"
          data-tour="pdf-upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
        >
          {loading ? (
            <>
              <div className="spinner" />
              <p>Abriendo PDF…</p>
            </>
          ) : (
            <>
              <span className="pdf-dropzone-icon" aria-hidden>
                📄
              </span>
              <strong>Arrastra un PDF aquí o haz clic para subir</strong>
              <span>Ej.: INE escaneada → Ampliar INE → Descargar</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {pdf && (
        <div className="pdf-editor-workspace">
          <aside className="pdf-toolbar" data-tour="pdf-tools">
            <p className="pdf-toolbar-file" title={fileName}>
              {fileName}
            </p>

            <button
              type="button"
              className="pdf-tool-btn pdf-tool-btn--primary"
              data-tour="pdf-enlarge"
              disabled={detecting || exporting}
              onClick={() => void amplifyIne()}
            >
              {detecting ? 'Detectando INE…' : 'Ampliar INE en la hoja'}
            </button>

            <div className="pdf-view-toggle" role="group" aria-label="Vista">
              <button
                type="button"
                className={!showResult ? 'pdf-tool-btn--on' : ''}
                onClick={() => setShowResult(false)}
              >
                Original
              </button>
              <button
                type="button"
                className={showResult ? 'pdf-tool-btn--on' : ''}
                disabled={!edit.crop && !edit.fillPage}
                onClick={() => setShowResult(true)}
              >
                Resultado
              </button>
            </div>

            <label className="pdf-field">
              Página
              <div className="pdf-page-nav">
                <button
                  type="button"
                  disabled={pageIndex <= 0}
                  onClick={() => {
                    setPageIndex((i) => i - 1);
                    setShowResult(false);
                  }}
                >
                  ‹
                </button>
                <span>
                  {pageIndex + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => {
                    setPageIndex((i) => i + 1);
                    setShowResult(false);
                  }}
                >
                  ›
                </button>
              </div>
            </label>

            <label className="pdf-field">
              Zoom vista (solo pantalla)
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={previewZoom}
                onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
              />
              <span className="pdf-field-val">{previewZoom.toFixed(1)}×</span>
            </label>

            <div className="pdf-btn-row">
              <button
                type="button"
                className="pdf-tool-btn"
                data-tour="pdf-rotate"
                onClick={() =>
                  setPageEdit(pageIndex, {
                    rotation: ((edit.rotation + 90) % 360) as PageEdit['rotation'],
                    crop: null,
                    fillPage: false,
                  })
                }
              >
                Rotar 90°
              </button>
              <button
                type="button"
                className={`pdf-tool-btn ${cropMode ? 'pdf-tool-btn--on' : ''}`}
                data-tour="pdf-crop"
                disabled={showResult}
                onClick={() => {
                  setShowResult(false);
                  setCropMode((v) => !v);
                  setDraftCrop(null);
                }}
              >
                {cropMode ? 'Recortando…' : 'Recortar a mano'}
              </button>
            </div>

            {edit.crop && (
              <button
                type="button"
                className="pdf-btn-ghost"
                onClick={() => {
                  setPageEdit(pageIndex, { crop: null, fillPage: false });
                  setShowResult(false);
                  setDraftCrop(null);
                }}
              >
                Quitar recorte
              </button>
            )}

            <p className="pdf-hint">
              {showResult
                ? 'Así quedará la INE en el PDF descargado (centrada y grande en hoja carta).'
                : cropMode
                  ? 'Arrastra sobre la tarjeta. Al soltar se agranda en la hoja.'
                  : 'Pulsa «Ampliar INE en la hoja»: detecta la tarjeta sola y la agranda. Luego descarga.'}
            </p>
          </aside>

          <div className="pdf-canvas-wrap" ref={wrapRef} data-tour="pdf-preview">
            {exporting && (
              <div className="pdf-export-overlay">
                <div className="spinner" />
                <p>{exportProgress || 'Generando PDF…'}</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className={`pdf-canvas ${cropMode && !showResult ? 'pdf-canvas--crop' : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        </div>
      )}
    </div>
  );
}
