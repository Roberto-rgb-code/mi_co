export interface BultoInput {
  id?: string;
  label?: string;
  largo: number;
  ancho: number;
  alto: number;
  cantidad: number;
  color?: string;
}

export interface CubicajeInput {
  modelo: string;
  bultos: BultoInput[];
  pesoEstimadoKg?: number;
}

export interface BultoColocado {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  largo: number;
  ancho: number;
  alto: number;
  color: string;
}

export interface CubicajeResult {
  modelo: string;
  contenedor: { largo: number; ancho: number; alto: number };
  bultos: BultoColocado[];
  totalSolicitados: number;
  totalColocados: number;
  noCabe: number;
  cabenTodos: boolean;
  utilizacionVolumen: number;
  pesoEstimadoKg?: number;
  pesoMaxKg?: number;
  pesoOk: boolean;
  mensaje: string;
}

export type CameraPreset = 'iso' | 'side' | 'top';

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: [number, number, number]; label: string }
> = {
  iso: { position: [1.2, 0.9, 1.2], label: 'Isométrica' },
  side: { position: [0.01, 0.3, 1.8], label: 'Lateral' },
  top: { position: [0.01, 2.5, 0.01], label: 'Superior' },
};
