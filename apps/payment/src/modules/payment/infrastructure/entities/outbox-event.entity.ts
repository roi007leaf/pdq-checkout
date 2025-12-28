import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export enum OutboxStatus {
  PENDING = "PENDING",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
}

/**
 * Outbox pattern entity for reliable event publishing.
 * Events are written to this table in the same transaction as business logic,
 * then published asynchronously by the outbox publisher.
 */
@Entity("outbox_events")
@Index("idx_payment_outbox_status_available", ["status", "availableAt"])
export class OutboxEventEntity {
  @PrimaryColumn({ type: "uuid" })
  id: string;

  @Column({ type: "varchar", length: 100 })
  aggregateType: string;

  @Column({ type: "uuid" })
  aggregateId: string;

  @Column({ type: "varchar", length: 100 })
  eventType: string;

  @Column({ type: "int", default: 1 })
  eventVersion: number;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  headers: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 20, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: "int", default: 0 })
  retryCount: number;

  @Column({ type: "timestamptz" })
  availableAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  @Column({ type: "text", nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
