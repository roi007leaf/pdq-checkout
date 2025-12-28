import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import {
  OutboxEventEntity,
  OutboxStatus,
} from "./infrastructure/entities/outbox-event.entity";

@Injectable()
export class OutboxService {
  async createEvent(
    manager: EntityManager,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
    headers?: Record<string, unknown>
  ): Promise<OutboxEventEntity> {
    const event = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType,
      aggregateId,
      eventType,
      eventVersion: 1,
      payload,
      headers: headers || null,
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    return manager.save(event);
  }
}
