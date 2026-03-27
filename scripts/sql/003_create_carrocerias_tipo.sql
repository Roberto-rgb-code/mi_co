-- Catálogo visual de tipos de caja (caja seca, redilas, plataforma)
CREATE TABLE IF NOT EXISTS carrocerias_tipo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  "usoTipico" TEXT,
  acomodamiento TEXT,
  "imagenUrl" VARCHAR(512) NOT NULL,
  orden INTEGER DEFAULT 0
);

INSERT INTO carrocerias_tipo (slug, nombre, descripcion, "usoTipico", acomodamiento, "imagenUrl", orden)
VALUES
(
  'caja-seca',
  'Caja seca (furgón cerrado)',
  'Carrocería cerrada tipo furgón: carga protegida de lluvia y polvo.',
  'Abarrotes, empaques, mudanzas, paquetería, productos que requieren techo y paredes.',
  'Paletizar de la pared frontal hacia la puerta trasera; peso más pesado abajo y hacia el eje delantero; amarrar con bandas; no exceder altura útil; dejar pasillo si hay acceso lateral.',
  '/images/carrocerias/caja-seca.svg',
  1
),
(
  'redilas',
  'Redilas (barandas / costales)',
  'Caja abierta con barandas horizontales; ventilación lateral.',
  'Frutas, verduras, materiales que toleran algo de aire, carga general con contención lateral.',
  'Apilar en el sentido del largo del chasis; no pasar de la altura de la redila sin lona o malla; centrar peso; sujetar con cuerdas o bandas a las barandas; cuidar que no se salga por los costados.',
  '/images/carrocerias/redilas.svg',
  2
),
(
  'plataforma',
  'Plataforma / rampa (grúa-plataforma)',
  'Plataforma plana sin paredes; a veces con rampa o cola inclinada para carga rodada.',
  'Maquinaria, vehículos ligeros, tarimas muy anchas, cargas que se cargan con montacargas por los costados.',
  'Bajar el centro de gravedad; peso centrado en el largo del chasis; amarrar con estrobos a argollas; si hay rampa, alinear ruedas con la pendiente; proteger con lonas solo si aplica.',
  '/images/carrocerias/plataforma.svg',
  3
)
ON CONFLICT (slug) DO NOTHING;
