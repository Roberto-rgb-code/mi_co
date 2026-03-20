import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  empresa: string;

  /** Producto o material a transportar (ej: peras, abarrotes, materiales construcción) */
  @Column({ nullable: true })
  productoTransportar: string;

  /** Cantidad de tarimas/pallets */
  @Column('int', { default: 0 })
  cantidadTarimas: number;

  /** Dimensiones tarima en metros: largo x ancho x alto. Estandar México ~1.20 x 1.00 x 1.50 */
  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  tarimaLargo: number;

  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  tarimaAncho: number;

  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  tarimaAlto: number;

  /** Peso estimado carga en kg */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  pesoEstimadoKg: number;

  /** Requerimientos especiales: refrigerado, grúa, etc. */
  @Column('text', { nullable: true })
  requerimientos: string;

  /** Modelo recomendado por el asistente (ELF 500K, etc.) */
  @Column({ nullable: true })
  modeloRecomendado: string;

  /** Notas adicionales, necesidades del cliente */
  @Column('text', { nullable: true })
  notaNecesidades: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
