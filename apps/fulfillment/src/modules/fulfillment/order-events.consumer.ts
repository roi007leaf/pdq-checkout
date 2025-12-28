import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Consumer, Kafka, logLevel } from "kafkajs";
import { DataSource } from "typeorm";
import { FulfillmentService } from "./fulfillment.service";

type OrderCreatedEnvelope = {
  specVersion: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId?: string | null;
  data: {
    orderId: string;
    [k: string]: unknown;
  };
};

const TOPIC = "order.events";
const DEFAULT_GROUP = "pdq-fulfillment-dev";

@Injectable()
export class OrderEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer | null = null;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly fulfillmentService: FulfillmentService
  ) {}

  async onModuleInit() {
    const brokers = this.configService.get("KAFKA_BROKERS", "localhost:19092");
    const groupId = this.configService.get(
      "KAFKA_CONSUMER_GROUP",
      DEFAULT_GROUP
    );

    try {
      const kafka = new Kafka({
        clientId: "pdq-fulfillment",
        brokers: brokers.split(","),
        logLevel: logLevel.WARN,
      });

      this.consumer = kafka.consumer({ groupId });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: TOPIC, fromBeginning: true });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;

          let env: OrderCreatedEnvelope;
          try {
            env = JSON.parse(message.value.toString("utf-8"));
          } catch {
            console.warn("⚠️ Skipping non-JSON message");
            return;
          }

          if (env.eventType !== "OrderCreated" || !env.data?.orderId) return;

          await this.dataSource.transaction(async (manager) => {
            await this.fulfillmentService.handleOrderCreated(manager, {
              consumerGroup: groupId,
              topic,
              partition,
              offset: message.offset,
              orderId: env.data.orderId,
              payload: env.data as unknown as Record<string, unknown>,
            });
          });
        },
      });

      this.isConnected = true;
      console.log(
        `✅ Fulfillment consumer connected (topic: ${TOPIC}, group: ${groupId})`
      );
    } catch (e: unknown) {
      console.warn(
        "⚠️ Fulfillment consumer disabled (Kafka not available):",
        e instanceof Error ? e.message : e
      );
    }
  }

  async onModuleDestroy() {
    if (this.consumer && this.isConnected) {
      await this.consumer.disconnect();
    }
  }
}
