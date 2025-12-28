import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, logLevel, Producer } from "kafkajs";
import { v4 as uuidv4 } from "uuid";

export interface CloudEvent<T = Record<string, unknown>> {
  specVersion: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  source: string;
  occurredAt: string;
  correlationId?: string | null;
  data: T;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const brokers = this.configService.get("KAFKA_BROKERS", "localhost:19092");

    try {
      const kafka = new Kafka({
        clientId: "pdq-api-gateway",
        brokers: brokers.split(","),
        logLevel: logLevel.WARN,
      });

      this.producer = kafka.producer();
      await this.producer.connect();
      this.isConnected = true;

      console.log("✅ API Gateway Kafka producer connected");
    } catch (e: unknown) {
      console.warn(
        "⚠️ API Gateway Kafka producer disabled (Kafka not available):",
        e instanceof Error ? e.message : e
      );
    }
  }

  async onModuleDestroy() {
    if (this.producer && this.isConnected) {
      await this.producer.disconnect();
    }
  }

  /**
   * Check if Kafka is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Send a CloudEvent to a Kafka topic
   */
  async send<T extends Record<string, unknown>>(
    topic: string,
    key: string,
    eventType: string,
    data: T,
    correlationId?: string
  ): Promise<void> {
    if (!this.producer || !this.isConnected) {
      throw new Error("Kafka producer not connected");
    }

    const cloudEvent: CloudEvent<T> = {
      specVersion: "1.0",
      eventId: uuidv4(),
      eventType,
      eventVersion: 1,
      source: "api-gateway",
      occurredAt: new Date().toISOString(),
      correlationId: correlationId || null,
      data,
    };

    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(cloudEvent),
          headers: {
            eventType,
            source: "api-gateway",
          },
        },
      ],
    });

    console.log(`📤 [API Gateway] Sent ${eventType} to ${topic} (key: ${key})`);
  }
}
