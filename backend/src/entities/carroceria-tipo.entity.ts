import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Tipos de caja / carrocería con imagen y guía de acomodo (referencia visual). */
@Entity('carrocerias_tipo')
export class CarroceriaTipo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  nombre: string;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column('text', { nullable: true })
  usoTipico: string;

  /** Cómo acomodar el producto según tipo de caja */
  @Column('text', { nullable: true })
  acomodamiento: string;

  /** Ruta pública, ej. /images/carrocerias/caja-seca.svg */
  @Column()
  imagenUrl: string;

  @Column({ default: 0 })
  orden: number;
}
