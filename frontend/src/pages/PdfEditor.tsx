import { useCallback, useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import './PdfEditor.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type CropRect = { x: number; y: number; w: number; h: number };

type PageEdit = {
  rotation: 0 | 90 | 180 | 270;
  /** Factor de ampliación al exportar (1 = original). */
  enlarge: number;
  crop: CropRect | null;
};

const DEFAULT_EDIT: PageEdit = { rotation: 0, enlarge: 1, crop: null };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  /** Renderiza la página actual al canvas de preview. */
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const token = ++renderToken.current;
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageIndex + 1);
      if (cancelled || token !== renderToken.current) return;

      const rot = edit.rotation;
      const base = page.getViewport({ scale: 1, rotation: rot });
      const maxW = Math.min(900, (wrapRef.current?.clientWidth ?? 800) - 24);
      const fit = maxW / base.width;
      const scale = fit * previewZoom;
      const viewport = page.getViewport({ scale, rotation: rot });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled || token !== renderToken.current) return;

      // Overlay de recorte activo
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
  }, [pdf, pageIndex, edit.rotation, edit.crop, draftCrop, previewZoom]);

  const canvasPoint = (e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cropMode) return;
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
    const x = Math.min(dragging.x, p.x);
    const y = Math.min(dragging.y, p.y);
    const w = Math.abs(p.x - dragging.x);
    const h = Math.abs(p.y - dragging.y);
    setDraftCrop({ x, y, w, h });
  };

  const onPointerUp = () => {
    if (!cropMode || !dragging || !draftCrop) {
      setDragging(null);
      return;
    }
    setDragging(null);
    if (draftCrop.w > 0.02 && draftCrop.h > 0.02) {
      setPageEdit(pageIndex, { crop: draftCrop });
    }
    setDraftCrop(null);
  };

  /** Renderiza una página editada a PNG (bytes) para armar el PDF de salida. */
  const renderPageToPng = async (
    doc: PDFDocumentProxy,
    idx: number,
    e: PageEdit,
  ): Promise<{ bytes: Uint8Array; width: number; height: number }> => {
    const page = await doc.getPage(idx + 1);
    const exportScale = 2 * e.enlarge;
    const viewport = page.getViewport({ scale: exportScale, rotation: e.rotation });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    let out = canvas;
    if (e.crop && e.crop.w > 0.01 && e.crop.h > 0.01) {
      const sx = Math.floor(e.crop.x * canvas.width);
      const sy = Math.floor(e.crop.y * canvas.height);
      const sw = Math.max(1, Math.floor(e.crop.w * canvas.width));
      const sh = Math.max(1, Math.floor(e.crop.h * canvas.height));
      const cropped = document.createElement('canvas');
      // Ampliar el recorte para que ocupe más espacio en la hoja
      const targetW = Math.min(1200, Math.max(sw, Math.round(sw * e.enlarge)));
      const targetH = Math.round((sh / sw) * targetW);
      cropped.width = targetW;
      cropped.height = targetH;
      const cctx = cropped.getContext('2d')!;
      cctx.fillStyle = '#fff';
      cctx.fillRect(0, 0, targetW, targetH);
      cctx.imageSmoothingEnabled = true;
      cctx.imageSmoothingQuality = 'high';
      cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
      out = cropped;
    }

    const blob: Blob = await new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar PNG'))), 'image/png');
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, width: out.width, height: out.height };
  };

  const downloadEdited = async () => {
    if (!pdf || !sourceBytesRef.current) return;
    setExporting(true);
    setError(null);
    try {
      // Reabrir con pdfjs desde bytes originales (el proxy ya está cargado)
      const outPdf = await PDFDocument.create();

      for (let i = 0; i < pageCount; i++) {
        const e = edits[i] ?? DEFAULT_EDIT;
        const { bytes, width, height } = await renderPageToPng(pdf, i, e);
        const png = await outPdf.embedPng(bytes);
        // Página del tamaño de la imagen (INE ampliada = hoja más grande o imagen grande)
        const page = outPdf.addPage([width * 0.75, height * 0.75]);
        page.drawImage(png, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
      }

      const pdfBytes = await outPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = fileName.replace(/\.pdf$/i, '') || 'documento';
      a.href = url;
      a.download = `${base}-editado.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page pdf-editor" data-tour="pdf-root">
      <header className="pdf-editor-header" data-tour="pdf-header">
        <div>
          <h1>Editor de PDF</h1>
          <p className="pdf-editor-sub">
            Sube un PDF (p. ej. INE escaneada), amplía, recorta o rota y descarga el resultado.
          </p>
        </div>
        <div className="pdf-editor-header-actions">
          {pdf && (
            <button
              type="button"
              className="btn-primary"
              data-tour="pdf-download"
              disabled={exporting}
              onClick={() => void downloadEdited()}
            >
              {exporting ? 'Generando…' : 'Descargar PDF'}
            </button>
          )}
          {pdf && (
            <button type="button" className="pdf-btn-ghost" onClick={resetDoc}>
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
              <span>Ideal para INE escaneadas: ampliar, recortar y descargar</span>
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
            <label className="pdf-field">
              Página
              <div className="pdf-page-nav">
                <button
                  type="button"
                  disabled={pageIndex <= 0}
                  onClick={() => setPageIndex((i) => i - 1)}
                >
                  ‹
                </button>
                <span>
                  {pageIndex + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPageIndex((i) => i + 1)}
                >
                  ›
                </button>
              </div>
            </label>

            <label className="pdf-field">
              Zoom vista
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

            <label className="pdf-field" data-tour="pdf-enlarge">
              Ampliar al exportar
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={edit.enlarge}
                onChange={(e) => setPageEdit(pageIndex, { enlarge: parseFloat(e.target.value) })}
              />
              <span className="pdf-field-val">{edit.enlarge.toFixed(1)}×</span>
            </label>

            <div className="pdf-btn-row">
              <button
                type="button"
                className="pdf-tool-btn"
                data-tour="pdf-rotate"
                onClick={() =>
                  setPageEdit(pageIndex, {
                    rotation: ((edit.rotation + 90) % 360) as PageEdit['rotation'],
                  })
                }
              >
                Rotar 90°
              </button>
              <button
                type="button"
                className={`pdf-tool-btn ${cropMode ? 'pdf-tool-btn--on' : ''}`}
                data-tour="pdf-crop"
                onClick={() => {
                  setCropMode((v) => !v);
                  setDraftCrop(null);
                }}
              >
                {cropMode ? 'Recortando…' : 'Recortar'}
              </button>
            </div>

            {edit.crop && (
              <button
                type="button"
                className="pdf-btn-ghost"
                onClick={() => {
                  setPageEdit(pageIndex, { crop: null });
                  setDraftCrop(null);
                }}
              >
                Quitar recorte
              </button>
            )}

            <p className="pdf-hint">
              {cropMode
                ? 'Arrastra sobre la imagen para marcar la zona (p. ej. la INE). Luego ajusta «Ampliar» y descarga.'
                : 'Usa Recortar para enfocar la INE, Ampliar para hacerla más grande al descargar.'}
            </p>
          </aside>

          <div className="pdf-canvas-wrap" ref={wrapRef} data-tour="pdf-preview">
            <canvas
              ref={canvasRef}
              className={`pdf-canvas ${cropMode ? 'pdf-canvas--crop' : ''}`}
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
