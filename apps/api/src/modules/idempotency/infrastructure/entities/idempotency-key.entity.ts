import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum IdempotencyStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('idempotency_keys')
@Index('idx_idempotency_key_scope', ['key', 'scope'], { unique: true })
@Index('idx_idempotency_expires', ['expiresAt'])
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'varchar', length: 100 })
  scope: string; // e.g., "POST:/api/checkout/payment"

  @Column({ type: 'varchar', length: 64 })
  requestHash: string; // SHA-256 of request body

  @Column({ type: 'varchar', length: 20 })
  status: IdempotencyStatus;

  @Column({ type: 'int', nullable: true })
  responseCode: number | null;

  @Column({ type: 'jsonb', nullable: true })
  responseBody: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
