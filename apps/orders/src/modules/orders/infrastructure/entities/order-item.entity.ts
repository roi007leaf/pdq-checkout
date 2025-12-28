import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrderEntity } from "./order.entity";

@Entity("order_items")
export class OrderItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  productId: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "int" })
  unitPrice: number; // cents

  @Column({ type: "int" })
  totalPrice: number; // cents

  @ManyToOne(() => OrderEntity, (order) => order.items)
  @JoinColumn({ name: "orderId" })
  order: OrderEntity;
}
