import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModelosTable1731340800000 implements MigrationInterface {
  name = 'CreateModelosTable1731340800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "modelos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "catalogo" character varying NOT NULL,
        "familia" character varying NOT NULL,
        "nomenclatura" character varying NOT NULL,
        "precio" numeric(12,2) NOT NULL,
        "yearModelo" integer NOT NULL DEFAULT 2026,
        "capacidadCarga" character varying,
        "largoChasis" numeric(8,2),
        "altoCamion" numeric(8,2),
        "anchoCabina" numeric(8,2),
        "largoAplicacion" numeric(8,2),
        "altoAplicacion" numeric(8,2),
        "anchoAplicacion" numeric(8,2),
        "distanciaEntreEjes" numeric(8,2),
        "pvb" character varying,
        "motor" text,
        "tecnologia" character varying,
        "garantia" character varying,
        "equipo" text,
        "frenos" character varying,
        "hp" character varying,
        "torque" character varying,
        "kmPorLitro" character varying,
        "llantas" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_modelos_catalogo" UNIQUE ("catalogo"),
        CONSTRAINT "PK_modelos" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "modelos"`);
  }
}
