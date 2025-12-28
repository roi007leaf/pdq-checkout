import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderItemEntity } from "./order-item.entity";
import { ShippingAddressEntity } from "./shipping-address.entity";

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

@Entity("orders")
export class OrderEntity {
  @PrimaryGeneratedColumn("uuid")
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
