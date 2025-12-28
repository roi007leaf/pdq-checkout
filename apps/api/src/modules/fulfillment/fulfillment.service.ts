import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ConsumerInboxEntity } from "./infrastructure/entities/consumer-inbox.entity";
import {
  FulfillmentStatus,
  FulfillmentTaskEntity,
} from "./infrastructure/entities/fulfillment-task.entity";

@Injectable()
export class FulfillmentService {
  /**
   * Idempotent handler: if the inbox record exists, we consider the message already processed.
   */
  async handleOrderCreated(
    manager: EntityManager,
    input: {
      consumerGroup: string;
      topic: string;
      partition: number;
      offset: string;
      orderId: string;
      payload: Record<string, unknown>;
    }
  ): Promise<{ processed: boolean }> {
    // Insert inbox first (dedupe). If unique violation occurs, skip.
    const inbox = manager.create(ConsumerInboxEntity, {
      consumerGroup: input.consumerGroup,
      topic: input.topic,
      partition: input.partition,
      offset: input.offset,
    });

    try {
      await manager.save(inbox);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.toLowerCase().includes("duplicate")) {
        return { processed: false };
      }
      throw e;
    }

    // Create a fulfillment task (also safe due to unique orderId)
    const task = manager.create(FulfillmentTaskEntity, {
      orderId: input.orderId,
      status: FulfillmentStatus.PENDING,
      payload: input.payload,
    });

    try {
      await manager.save(task);
    } catch (e: unknown) {
      // If task already exists, it is safe to ignore.
      if (e instanceof Error && e.message.toLowerCase().includes("duplicate")) {
        return { processed: true };
      }
      throw e;
    }

    return { processed: true };
  }
}
