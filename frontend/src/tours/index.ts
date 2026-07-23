import { driver, type DriveStep, type Side } from 'driver.js';
import 'driver.js/dist/driver.css';

export type TourId =
  | 'inicio'
  | 'cotizador'
  | 'catalogo'
  | 'asistente'
  | 'comparativa'
  | 'cubicaje'
  | 'crm'
  | 'pdf';

const TOUR_STORAGE_PREFIX = 'isuzu-tour-seen:';

function step(
  element: string,
  title: string,
  description: string,
  side: Side = 'bottom',
): DriveStep {
  return {
    element,
    popover: {
      title,
      description,
      side,
      align: 'start',
    },
  };
}

export const TOURS: Record<TourId, { title: string; steps: DriveStep[] }> = {
  inicio: {
    title: 'Inicio',
    steps: [
      step('[data-tour="sidebar"]', 'Menú lateral', 'Navega entre Cotizador, Catálogo, Cubicaje, CRM y más.'),
      step('[data-tour="tour-btn"]', 'Tour guiado', 'En cada módulo puedes volver a abrir este recorrido.'),
      step('[data-tour="inicio-actions"]', 'Accesos rápidos', 'Entra directo a las herramientas más usadas.'),
    ],
  },
  cotizador: {
    title: 'Cotizador',
    steps: [
      step('[data-tour="cotizador-root"]', 'Cotizador', 'Aquí generas cotizaciones de modelos ISUZU.'),
      step('[data-tour="cotizador-lista"]', 'Modelos', 'Elige un modelo de la lista para ver precio y detalle.'),
    ],
  },
  catalogo: {
    title: 'Catálogo',
    steps: [
      step('[data-tour="catalogo-root"]', 'Catálogo', 'Explora la flota ELF y Forward con fichas técnicas.'),
      step('[data-tour="catalogo-grid"]', 'Tarjetas', 'Haz clic en un modelo para ver especificaciones.'),
    ],
  },
  asistente: {
    title: 'Asistente',
    steps: [
      step('[data-tour="asistente-root"]', 'Asistente', 'Describe tu carga o negocio y recibe orientación.'),
      step('[data-tour="asistente-chat"]', 'Chat', 'Escribe en lenguaje natural; el asistente te recomienda.'),
    ],
  },
  comparativa: {
    title: 'Comparativa',
    steps: [
      step('[data-tour="comparativa-root"]', 'Comparativa', 'Compara un camión de la competencia vs ISUZU.'),
      step('[data-tour="comparativa-form"]', 'Datos', 'Captura el modelo rival y revisa la sugerencia ISUZU.'),
    ],
  },
  cubicaje: {
    title: 'Cubicaje 3D',
    steps: [
      step('[data-tour="cubicaje-root"]', 'Cubicaje', 'Simula cómo se acomoda la carga en la caja del camión.'),
      step('[data-tour="cubicaje-fleet"]', 'Flota', 'Elige el modelo; verás medidas exterior e interior.'),
      step('[data-tour="cubicaje-ai"]', 'Asistente IA', 'Describe la mercancía y se configura inventario + simulación.'),
      step('[data-tour="cubicaje-cargar"]', 'Cargar', 'Calcula el acomodo 3D, peso y volumen.'),
    ],
  },
  crm: {
    title: 'CRM',
    steps: [
      step('[data-tour="crm-root"]', 'CRM', 'Gestiona clientes y sus necesidades de transporte.'),
      step('[data-tour="crm-nuevo"]', 'Nuevo cliente', 'Registra un cliente para cotizar y hacer seguimiento.'),
    ],
  },
  pdf: {
    title: 'Editor PDF',
    steps: [
      step('[data-tour="pdf-upload"], [data-tour="pdf-preview"]', 'Documento', 'Sube un PDF (por ejemplo una INE escaneada).'),
      step('[data-tour="pdf-enlarge"], [data-tour="pdf-tools"]', 'Ampliar INE', 'Detecta la tarjeta en el escaneo y la agranda en la hoja (no es solo zoom).'),
      step('[data-tour="pdf-download"], [data-tour="pdf-header"]', 'Descargar', 'Cuando veas el Resultado, descarga el PDF editado.'),
    ],
  },
};

export function tourIdFromPath(pathname: string): TourId | null {
  if (pathname === '/') return 'inicio';
  if (pathname.startsWith('/cotizador')) return 'cotizador';
  if (pathname.startsWith('/catalogo')) return 'catalogo';
  if (pathname.startsWith('/asistente')) return 'asistente';
  if (pathname.startsWith('/comparativa')) return 'comparativa';
  if (pathname.startsWith('/cubicaje')) return 'cubicaje';
  if (pathname.startsWith('/crm')) return 'crm';
  if (pathname.startsWith('/pdf')) return 'pdf';
  return null;
}

export function hasSeenTour(id: TourId): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_PREFIX + id) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(id: TourId) {
  try {
    localStorage.setItem(TOUR_STORAGE_PREFIX + id, '1');
  } catch {
    //
  }
}

/** Resuelve el primer selector que exista y descarta pasos sin target. */
function availableSteps(steps: DriveStep[]): DriveStep[] {
  const out: DriveStep[] = [];
  for (const s of steps) {
    if (!s.element || typeof s.element !== 'string') {
      out.push(s);
      continue;
    }
    const match = s.element
      .split(',')
      .map((sel) => sel.trim())
      .find((sel) => document.querySelector(sel));
    if (match) out.push({ ...s, element: match });
  }
  return out;
}

export function startTour(id: TourId, _opts?: { force?: boolean }) {
  const def = TOURS[id];
  if (!def) return;

  const steps = availableSteps(def.steps);
  if (steps.length === 0) return;

  const d = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 10,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Listo',
    progressText: '{{current}} de {{total}}',
    steps,
    onDestroyStarted: () => {
      markTourSeen(id);
      d.destroy();
    },
  });

  d.drive();
}

export function maybeAutoStartTour(id: TourId) {
  if (hasSeenTour(id)) return;
  // Espera a que el DOM del módulo esté listo
  window.setTimeout(() => startTour(id), 450);
}
