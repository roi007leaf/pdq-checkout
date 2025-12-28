import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OutboxStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

@Entity('outbox_events')
@Index('idx_outbox_pending', ['status', 'availableAt', 'createdAt'])
export class OutboxEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  aggregateType: string; // e.g., "order"

  @Column({ type: 'uuid' })
  aggregateId: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string; // e.g., "OrderCreated"

  @Column({ type: 'int', default: 1 })
  eventVersion: number;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20 })
  status: OutboxStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  availableAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;
}
