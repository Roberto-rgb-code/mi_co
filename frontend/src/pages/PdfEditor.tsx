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

type CardOrientation = 'horizontal' | 'vertical';

type PageEdit = {
  rotation: 0 | 90 | 180 | 270;
  /** Uno o más recortes (frente / reverso). */
  crops: CropRect[];
  /** Escala real 1:1 al tamaño físico de la INE. */
  realScale: boolean;
  cardOrientation: CardOrientation;
};

const DEFAULT_EDIT: PageEdit = {
  rotation: 0,
  crops: [],
  realScale: false,
  cardOrientation: 'vertical',
};

/** ISO/IEC 7810 ID-1 = tamaño físico de la INE (mm). */
const INE_LONG_MM = 85.6;
const INE_SHORT_MM = 54.0;

const LETTER_W = 612; // pt
const LETTER_H = 792;
const MAX_EXPORT_PX = 1800;
const DETECT_SCALE = 1.5;
const MM_TO_PT = 72 / 25.4;

function mmToPt(mm: number) {
  return mm * MM_TO_PT;
}

function ineSizePts(orientation: CardOrientation): { w: number; h: number } {
  if (orientation === 'vertical') {
    return { w: mmToPt(INE_SHORT_MM), h: mmToPt(INE_LONG_MM) };
  }
  return { w: mmToPt(INE_LONG_MM), h: mmToPt(INE_SHORT_MM) };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function yieldUi() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

/**
 * Detecta una o dos INE en el escaneo (frente/reverso) por bandas de contenido
 * separadas por espacio en blanco.
 */
function detectIneCrops(canvas: HTMLCanvasElement): CropRect[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const { width: W, height: H } = canvas;
  if (W < 16 || H < 16) return [];

  const data = ctx.getImageData(0, 0, W, H).data;
  const threshold = 242;
  const step = 2;
  const rowHas = new Uint8Array(H);

  for (let y = 0; y < H; y += step) {
    let hit = false;
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (data[i] < threshold || data[i + 1] < threshold || data[i + 2] < threshold) {
        hit = true;
        break;
      }
    }
    if (hit) {
      for (let dy = 0; dy < step && y + dy < H; dy++) rowHas[y + dy] = 1;
    }
  }

  // Bandas verticales de contenido
  const bands: Array<{ y0: number; y1: number }> = [];
  let inBand = false;
  let y0 = 0;
  const minGap = Math.max(12, Math.round(H * 0.04));
  let gap = 0;

  for (let y = 0; y < H; y++) {
    if (rowHas[y]) {
      if (!inBand) {
        inBand = true;
        y0 = y;
      }
      gap = 0;
    } else if (inBand) {
      gap++;
      if (gap >= minGap) {
        bands.push({ y0, y1: y - gap });
        inBand = false;
        gap = 0;
      }
    }
  }
  if (inBand) bands.push({ y0, y1: H - 1 });

  const crops: CropRect[] = [];
  const pad = Math.max(3, Math.round(Math.min(W, H) * 0.012));

  for (const band of bands) {
    let minX = W;
    let maxX = 0;
    let minY = band.y1;
    let maxY = band.y0;
    let hits = 0;

    for (let y = band.y0; y <= band.y1; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4;
        if (data[i] < threshold || data[i + 1] < threshold || data[i + 2] < threshold) {
          hits++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (hits < 40) continue;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W - 1, maxX + pad);
    maxY = Math.min(H - 1, maxY + pad);

    const w = (maxX - minX + 1) / W;
    const h = (maxY - minY + 1) / H;
    if (w < 0.04 || h < 0.03) continue;
    if (w * h > 0.92) continue; // casi toda la página

    crops.push({ x: minX / W, y: minY / H, w, h });
  }

  // Si no hubo bandas útiles, un solo bbox global
  if (crops.length === 0) {
    let minX = W;
    let minY = H;
    let maxX = 0;
    let maxY = 0;
    let hits = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4;
        if (data[i] < threshold || data[i + 1] < threshold || data[i + 2] < threshold) {
          hits++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (hits > 80) {
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(W - 1, maxX + pad);
      maxY = Math.min(H - 1, maxY + pad);
      const w = (maxX - minX + 1) / W;
      const h = (maxY - minY + 1) / H;
      if (w < 0.95 || h < 0.95) {
        crops.push({ x: minX / W, y: minY / H, w, h });
      }
    }
  }

  // Máximo 2 (frente + reverso), las más grandes
  return crops
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 2)
    .sort((a, b) => a.y - b.y);
}

async function renderPageToCanvas(
  page: PDFPageProxy,
  rotation: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  let usedScale = scale;
  let viewport = page.getViewport({ scale: usedScale, rotation });
  const maxSide = Math.max(viewport.width, viewport.height);
  if (maxSide > MAX_EXPORT_PX) {
    usedScale = scale * (MAX_EXPORT_PX / maxSide);
    viewport = page.getViewport({ scale: usedScale, rotation });
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

function cropToCanvas(source: HTMLCanvasElement, crop: CropRect): HTMLCanvasElement {
  const sx = Math.floor(crop.x * source.width);
  const sy = Math.floor(crop.y * source.height);
  const sw = Math.max(1, Math.floor(crop.w * source.width));
  const sh = Math.max(1, Math.floor(crop.h * source.height));
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Compone vista previa a ~150 dpi de la hoja carta con INE a tamaño real. */
function composeRealScalePreview(
  source: HTMLCanvasElement,
  crops: CropRect[],
  orientation: CardOrientation,
): HTMLCanvasElement {
  const dpi = 120;
  const pageW = Math.round((LETTER_W / 72) * dpi);
  const pageH = Math.round((LETTER_H / 72) * dpi);
  const out = document.createElement('canvas');
  out.width = pageW;
  out.height = pageH;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, pageW, pageH);

  const size = ineSizePts(orientation);
  const cardW = (size.w / 72) * dpi;
  const cardH = (size.h / 72) * dpi;
  const gap = (12 / 25.4) * dpi; // 12 mm
  const list = crops.length ? crops : [{ x: 0, y: 0, w: 1, h: 1 }];
  const totalH = list.length * cardH + (list.length - 1) * gap;
  let y = Math.max(dpi * 0.4, (pageH - totalH) / 2);

  for (const crop of list) {
    const piece = cropToCanvas(source, crop);
    // Ajustar orientación de la imagen al hueco 1:1 (rotar si hace falta)
    const oriented = orientCardImage(piece, orientation);
    const x = (pageW - cardW) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(oriented, x, y, cardW, cardH);
    // Borde guía sutil
    ctx.strokeStyle = 'rgba(200,16,46,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, cardW, cardH);
    y += cardH + gap;
  }

  // Etiqueta de escala
  ctx.fillStyle = '#64748b';
  ctx.font = `${Math.round(dpi * 0.1)}px sans-serif`;
  const label =
    orientation === 'vertical'
      ? `Escala 1:1 — ${INE_SHORT_MM}×${INE_LONG_MM} mm (vertical)`
      : `Escala 1:1 — ${INE_LONG_MM}×${INE_SHORT_MM} mm (horizontal)`;
  ctx.fillText(label, dpi * 0.25, pageH - dpi * 0.2);

  return out;
}

/** Rota/encaja el recorte para que coincida con orientación pedida. */
function orientCardImage(img: HTMLCanvasElement, orientation: CardOrientation): HTMLCanvasElement {
  const wantPortrait = orientation === 'vertical';
  const isPortrait = img.height >= img.width;
  if (wantPortrait === isPortrait) return img;

  // Rotar 90°
  const out = document.createElement('canvas');
  out.width = img.height;
  out.height = img.width;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return out;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
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
  const [showResult, setShowResult] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const scale = Math.min(2, fit * previewZoom);
      const source = await renderPageToCanvas(page, edit.rotation, scale);
      if (cancelled || token !== renderToken.current) return;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (showResult && edit.realScale && edit.crops.length > 0) {
        const composed = composeRealScalePreview(source, edit.crops, edit.cardOrientation);
        const s = Math.min(1, maxW / composed.width);
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

      const overlays = draftCrop ? [...edit.crops, draftCrop] : edit.crops;
      if (overlays.length) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const crop of overlays) {
          const cx = crop.x * canvas.width;
          const cy = crop.y * canvas.height;
          const cw = crop.w * canvas.width;
          const ch = crop.h * canvas.height;
          ctx.drawImage(source, cx, cy, cw, ch, cx, cy, cw, ch);
          ctx.strokeStyle = '#c8102e';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx, cy, cw, ch);
        }
        ctx.restore();
      }
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Error al renderizar');
    });

    return () => {
      cancelled = true;
    };
  }, [
    pdf,
    pageIndex,
    edit.rotation,
    edit.crops,
    edit.realScale,
    edit.cardOrientation,
    draftCrop,
    previewZoom,
    showResult,
  ]);

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
      const next = [...edit.crops, draftCrop].slice(0, 2);
      setPageEdit(pageIndex, { crops: next, realScale: true });
      setShowResult(true);
      setCropMode(false);
    }
    setDraftCrop(null);
  };

  /** Detecta INE(s) y las coloca a tamaño físico 1:1 (sin ampliar ni reducir). */
  const applyRealScale = async () => {
    if (!pdf) return;
    setDetecting(true);
    setError(null);
    setCropMode(false);
    try {
      const page = await pdf.getPage(pageIndex + 1);
      await yieldUi();
      const source = await renderPageToCanvas(page, edit.rotation, DETECT_SCALE);
      await yieldUi();
      const crops = detectIneCrops(source);
      if (!crops.length) {
        setError(
          'No pude detectar la INE automáticamente. Usa «Recortar a mano» y marca cada tarjeta (frente/reverso).',
        );
        return;
      }
      setPageEdit(pageIndex, {
        crops,
        realScale: true,
        cardOrientation: edit.cardOrientation || 'vertical',
      });
      setShowResult(true);
      setPreviewZoom(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al preparar escala 1:1');
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
        const source = await renderPageToCanvas(page, e.rotation, 2);
        await yieldUi();

        if (e.realScale && e.crops.length > 0) {
          const pdfPage = outPdf.addPage([LETTER_W, LETTER_H]);
          const size = ineSizePts(e.cardOrientation);
          const gap = mmToPt(12);
          const totalH = e.crops.length * size.h + (e.crops.length - 1) * gap;
          let y = Math.max(mmToPt(15), (LETTER_H - totalH) / 2);

          for (const crop of e.crops) {
            const piece = orientCardImage(cropToCanvas(source, crop), e.cardOrientation);
            // Raster a buena resolución del hueco físico
            const dpi = 300;
            const pxW = Math.round((size.w / 72) * dpi);
            const pxH = Math.round((size.h / 72) * dpi);
            const cardCanvas = document.createElement('canvas');
            cardCanvas.width = Math.min(MAX_EXPORT_PX, pxW);
            cardCanvas.height = Math.min(MAX_EXPORT_PX, pxH);
            const cctx = cardCanvas.getContext('2d')!;
            cctx.fillStyle = '#fff';
            cctx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);
            cctx.imageSmoothingEnabled = true;
            cctx.imageSmoothingQuality = 'high';
            cctx.drawImage(piece, 0, 0, cardCanvas.width, cardCanvas.height);
            const bytes = await canvasToJpegBytes(cardCanvas, 0.93);
            const jpg = await outPdf.embedJpg(bytes);
            const x = (LETTER_W - size.w) / 2;
            // pdf-lib: origen abajo-izquierda
            const drawY = LETTER_H - y - size.h;
            pdfPage.drawImage(jpg, { x, y: drawY, width: size.w, height: size.h });
            y += size.h + gap;
          }
        } else {
          // Sin escala real: página completa centrada en carta (no forzar tamaño INE)
          const composed = document.createElement('canvas');
          const maxW = Math.min(MAX_EXPORT_PX, source.width);
          const s = maxW / source.width;
          composed.width = Math.floor(source.width * s);
          composed.height = Math.floor(source.height * s);
          composed.getContext('2d')!.drawImage(source, 0, 0, composed.width, composed.height);
          const bytes = await canvasToJpegBytes(composed, 0.9);
          const jpg = await outPdf.embedJpg(bytes);
          const pdfPage = outPdf.addPage([LETTER_W, LETTER_H]);
          const scale = Math.min(LETTER_W / composed.width, LETTER_H / composed.height) * 0.92;
          const w = composed.width * scale;
          const h = composed.height * scale;
          pdfPage.drawImage(jpg, {
            x: (LETTER_W - w) / 2,
            y: (LETTER_H - h) / 2,
            width: w,
            height: h,
          });
        }
      }

      setExportProgress('Guardando…');
      await yieldUi();
      const pdfBytes = await outPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = fileName.replace(/\.pdf$/i, '') || 'documento';
      a.href = url;
      a.download = `${base}-escala-real.pdf`;
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

  const sizeLabel =
    edit.cardOrientation === 'vertical'
      ? `${INE_SHORT_MM} × ${INE_LONG_MM} mm`
      : `${INE_LONG_MM} × ${INE_SHORT_MM} mm`;

  return (
    <div className="page pdf-editor" data-tour="pdf-root">
      <header className="pdf-editor-header" data-tour="pdf-header">
        <div>
          <h1>Editor de PDF</h1>
          <p className="pdf-editor-sub">
            Prepara la INE a <strong>escala real 1:1</strong> ({sizeLabel}) para imprimir del mismo
            tamaño que la credencial física — sin ampliar ni reducir.
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
              <strong>Arrastra un PDF o haz clic para subir</strong>
              <span>INE escaneada → Escala real 1:1 → Imprimir tamaño físico</span>
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
              onClick={() => void applyRealScale()}
            >
              {detecting ? 'Detectando INE…' : 'Escala real 1:1 (imprimir)'}
            </button>

            <label className="pdf-field">
              Orientación de la credencial
              <select
                className="pdf-select"
                value={edit.cardOrientation}
                onChange={(e) => {
                  const cardOrientation = e.target.value as CardOrientation;
                  setPageEdit(pageIndex, { cardOrientation });
                  if (edit.crops.length) setShowResult(true);
                }}
              >
                <option value="vertical">Vertical ({INE_SHORT_MM}×{INE_LONG_MM} mm)</option>
                <option value="horizontal">Horizontal ({INE_LONG_MM}×{INE_SHORT_MM} mm)</option>
              </select>
            </label>

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
                disabled={!edit.realScale || !edit.crops.length}
                onClick={() => setShowResult(true)}
              >
                Resultado 1:1
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
                    crops: [],
                    realScale: false,
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

            {edit.crops.length > 0 && (
              <button
                type="button"
                className="pdf-btn-ghost"
                onClick={() => {
                  setPageEdit(pageIndex, { crops: [], realScale: false });
                  setShowResult(false);
                  setDraftCrop(null);
                }}
              >
                Quitar recortes ({edit.crops.length})
              </button>
            )}

            <p className="pdf-hint">
              {showResult
                ? `Así se imprimirá: ${sizeLabel} por tarjeta (tamaño físico INE). En la impresora usa escala 100% / tamaño real, sin «ajustar a la página».`
                : cropMode
                  ? 'Marca cada cara de la INE (hasta 2). Al soltar se coloca a tamaño real.'
                  : 'Pulsa «Escala real 1:1»: detecta la(s) tarjeta(s) y las deja del mismo tamaño que la INE física para imprimir.'}
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
