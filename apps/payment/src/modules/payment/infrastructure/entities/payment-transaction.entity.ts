import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

/**
 * Payment transaction entity - stores all payment attempts and results.
 * Each payment is tied to an orderId (idempotency key for the order).
 */
@Entity("payment_transactions")
@Index("idx_payment_order_id", ["orderId"])
@Index("idx_payment_status", ["status"])
@Index("idx_payment_created_at", ["createdAt"])
@Index("idx_payment_status_created", ["status", "createdAt"])
export class PaymentTransactionEntity {
  @PrimaryColumn({ type: "uuid" })
  id: string;

  @Column({ type: "uuid" })
  orderId: string;

  @Column({ type: "varchar", length: 50 })
  status: PaymentStatus;

  @Column({ type: "int" })
  amount: number; // cents

  @Column({ type: "varchar", length: 3 })
  currency: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  transactionId: string | null; // external gateway transaction ID

  @Column({ type: "varchar", length: 500, nullable: true })
  errorMessage: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  errorCode: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  paymentMethod: {
    type: "card";
    last4: string;
    brand?: string;
    expiryMonth?: string;
    expiryYear?: string;
  } | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
