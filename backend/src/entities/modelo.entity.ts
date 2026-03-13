import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('modelos')
export class Modelo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  catalogo: string; // ELF 100E, Forward 800K, etc.

  @Column()
  familia: string; // ELF | FORWARD

  @Column()
  nomenclatura: string; // 100, 200, 800, 1100, etc.

  @Column('decimal', { precision: 12, scale: 2 })
  precio: number;

  @Column({ default: 2026 })
  yearModelo: number;

  @Column({ nullable: true })
  capacidadCarga: string; // 1.8 T, 7 T, etc.

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  largoChasis: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  altoCamion: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  anchoCabina: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  largoAplicacion: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  altoAplicacion: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  anchoAplicacion: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  distanciaEntreEjes: number;

  @Column({ nullable: true })
  pvb: string; // Peso bruto vehicular

  @Column('text', { nullable: true })
  motor: string;

  @Column({ nullable: true })
  tecnologia: string; // EURO VI

  @Column({ nullable: true })
  garantia: string;

  @Column('text', { nullable: true })
  equipo: string;

  @Column({ nullable: true })
  frenos: string;

  @Column({ nullable: true })
  hp: string;

  @Column({ nullable: true })
  torque: string;

  @Column({ nullable: true })
  kmPorLitro: string;

  @Column({ nullable: true })
  llantas: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
