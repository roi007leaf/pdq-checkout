import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrderEntity } from "./order.entity";

@Entity("shipping_addresses")
export class ShippingAddressEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  fullName: string;

  @Column({ type: "varchar", length: 300 })
  addressLine1: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  addressLine2: string | null;

  @Column({ type: "varchar", length: 100 })
  city: string;

  @Column({ type: "varchar", length: 100 })
  state: string;

  @Column({ type: "varchar", length: 20 })
  postalCode: string;

  @Column({ type: "varchar", length: 100 })
  country: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string | null;

  @OneToOne(() => OrderEntity, (order) => order.shippingAddress)
  @JoinColumn({ name: "orderId" })
  order: OrderEntity;
}
