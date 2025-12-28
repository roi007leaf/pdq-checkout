import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Kafka, logLevel, Producer } from "kafkajs";
import { LessThanOrEqual, Repository } from "typeorm";
import {
  OutboxEventEntity,
  OutboxStatus,
} from "./infrastructure/entities/outbox-event.entity";

const PAYMENT_EVENTS_TOPIC = "payment.events";
const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 10;
const MAX_RETRIES = 5;

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private producer: Producer | null = null;
  private isConnected = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(OutboxEventEntity)
    private readonly outboxRepository: Repository<OutboxEventEntity>
  ) {}

  async onModuleInit() {
    const brokers = this.configService.get("KAFKA_BROKERS", "localhost:19092");

    try {
      const kafka = new Kafka({
        clientId: "pdq-payment-outbox",
        brokers: brokers.split(","),
        logLevel: logLevel.WARN,
      });

      this.producer = kafka.producer();
      await this.producer.connect();
      this.isConnected = true;

      // Start polling for outbox events
      this.pollInterval = setInterval(() => {
        this.publishPendingEvents().catch((err) => {
          console.error("❌ [Payment] Outbox publish error:", err.message);
        });
      }, POLL_INTERVAL_MS);

      console.log(`✅ Payment outbox publisher connected`);
    } catch (e: unknown) {
      console.warn(
        "⚠️ Payment outbox publisher disabled (Kafka not available):",
        e instanceof Error ? e.message : e
      );
    }
  }

  async onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.producer && this.isConnected) {
      await this.producer.disconnect();
    }
  }

  private async publishPendingEvents(): Promise<void> {
    if (!this.producer || !this.isConnected) return;

    const events = await this.outboxRepository.find({
      where: {
        status: OutboxStatus.PENDING,
        availableAt: LessThanOrEqual(new Date()),
      },
      order: { createdAt: "ASC" },
      take: BATCH_SIZE,
    });

    for (const event of events) {
      try {
        const cloudEvent = {
          specVersion: "1.0",
          eventId: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          source: "payment-service",
          occurredAt: event.createdAt.toISOString(),
          correlationId: event.headers?.correlationId || null,
          data: event.payload,
        };

        await this.producer.send({
          topic: PAYMENT_EVENTS_TOPIC,
          messages: [
            {
              key: event.aggregateId,
              value: JSON.stringify(cloudEvent),
              headers: {
                eventType: event.eventType,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
              },
            },
          ],
        });

        event.status = OutboxStatus.PUBLISHED;
        event.publishedAt = new Date();
        await this.outboxRepository.save(event);

        console.log(`📤 [Payment] Published: ${event.eventType} (${event.id})`);
      } catch (err: unknown) {
        event.retryCount += 1;
        event.lastError = err instanceof Error ? err.message : String(err);

        if (event.retryCount >= MAX_RETRIES) {
          event.status = OutboxStatus.FAILED;
          console.error(
            `❌ [Payment] Event ${event.id} failed after ${MAX_RETRIES} retries`
          );
        } else {
          // Exponential backoff
          event.availableAt = new Date(
            Date.now() + Math.pow(2, event.retryCount) * 1000
          );
        }

        await this.outboxRepository.save(event);
      }
    }
  }
}
