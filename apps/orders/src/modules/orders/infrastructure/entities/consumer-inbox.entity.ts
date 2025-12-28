import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Consumer inbox for idempotent message processing.
 */
@Entity("consumer_inbox")
@Index(
  "uniq_orders_consumer_inbox",
  ["consumerGroup", "topic", "partition", "offset"],
  {
    unique: true,
  }
)
export class ConsumerInboxEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  consumerGroup: string;

  @Column({ type: "varchar", length: 200 })
  topic: string;

  @Column({ type: "int" })
  partition: number;

  @Column({ type: "bigint" })
  offset: string;

  @CreateDateColumn({ type: "timestamptz" })
  processedAt: Date;
}
