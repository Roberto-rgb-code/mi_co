-- Tabla clientes para módulo CRM
-- Ejecutar: psql $DATABASE_URL -f scripts/sql/001_create_clientes.sql

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  empresa VARCHAR(255),
  "productoTransportar" VARCHAR(255),
  "cantidadTarimas" INTEGER DEFAULT 0,
  "tarimaLargo" DECIMAL(6,2),
  "tarimaAncho" DECIMAL(6,2),
  "tarimaAlto" DECIMAL(6,2),
  "pesoEstimadoKg" DECIMAL(10,2),
  requerimientos TEXT,
  "modeloRecomendado" VARCHAR(100),
  "notaNecesidades" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
