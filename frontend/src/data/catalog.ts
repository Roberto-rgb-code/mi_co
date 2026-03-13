// Tipos para el catálogo extraído de Excel
export interface ModeloCatalog {
  modelo: string;
  linea?: string;
  precio?: number;
  precio_2025?: number;
  precio_2026?: number;
  ano_modelo?: number;
  capacidad_carga?: string;
  largo_chasis?: number;
  alto_camion?: number;
  ancho_cabina?: number;
  largo_aplicacion?: number;
  alto_aplicacion?: number;
  ancho_aplicacion?: number;
  distancia_entre_ejes?: number;
  pvb?: number;
  motor?: string;
  tecnologia?: string;
  garantia?: string;
  equipo?: string;
  frenos?: string;
  hp?: string;
  torque?: string;
  km_litro?: string;
  llantas?: string;
  cubicaje_peso?: {
    exterior?: { largo_cm?: number; ancho_cm?: number; alto_cm?: number };
    exterior_carga?: { largo_cm?: number; ancho_cm?: number; alto_cm?: number };
    interior_carga_2?: { largo_cm?: number; ancho_cm?: number; alto_cm?: number };
  };
  image?: string; // ruta /images/xxx.png si existe
  distancia_consumo?: {
    capacidad_tanque_litros?: number;
    rendimiento_promedio_km_litro?: number;
    distancia_promedio_km?: number;
    hp?: number;
    torque_lb_pie?: number;
    motor_cilindros_litros?: string;
    frenos_tipo_rin?: string;
  };
}
