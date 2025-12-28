import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderItemEntity } from "./order-item.entity";
import { ShippingAddressEntity } from "./shipping-address.entity";

export enum OrderStatus {
  PENDING = "PENDING",
  PENDING_PAYMENT = "PENDING_PAYMENT",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

/**
 * Order entity - the main aggregate root for order management.
 * This service owns the complete order lifecycle.
 */
@Entity("orders")
@Index("idx_order_status", ["status"])
@Index("idx_order_payment_id", ["paymentId"])
@Index("idx_order_created_at", ["createdAt"])
@Index("idx_order_status_created", ["status", "createdAt"])
export class OrderEntity {
  @PrimaryColumn({ type: "uuid" })
  id: string;

  @Column({ type: "varchar", length: 50 })
  status: OrderStatus;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: string;

  @Column({ type: "int" })
  subtotal: number; // cents

  @Column({ type: "int", default: 0 })
  tax: number; // cents

  @Column({ type: "int" })
  grandTotal: number; // cents

  @Column({ type: "uuid", nullable: true })
  paymentId: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  paymentTransactionId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown>;

  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItemEntity[];

  @OneToOne(() => ShippingAddressEntity, (address) => address.order, {
    cascade: true,
    eager: true,
  })
  shippingAddress: ShippingAddressEntity;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
