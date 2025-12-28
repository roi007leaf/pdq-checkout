import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum FulfillmentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

@Entity("fulfillment_tasks")
@Index("uniq_fulfillment_order", ["orderId"], { unique: true })
export class FulfillmentTaskEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  orderId: string;

  @Column({ type: "varchar", length: 20 })
  status: FulfillmentStatus;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
