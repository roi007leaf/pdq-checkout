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

  @Column({ type: "uuid" })
  orderId: string;

  @OneToOne(() => OrderEntity, (order) => order.shippingAddress, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "orderId" })
  order: OrderEntity;

  @Column({ type: "varchar", length: 255 })
  fullName: string;

  @Column({ type: "varchar", length: 500 })
  streetAddress: string;

  @Column({ type: "varchar", length: 100 })
  city: string;

  @Column({ type: "varchar", length: 100 })
  stateProvince: string;

  @Column({ type: "varchar", length: 20 })
  postalCode: string;

  @Column({ type: "varchar", length: 100 })
  country: string;
}
