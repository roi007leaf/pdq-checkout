import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Consumer, Kafka, logLevel } from "kafkajs";
import { DataSource } from "typeorm";
import { OrdersService } from "./orders.service";

/**
 * Kafka message envelope for payment events from Payment service
 */
type PaymentEventEnvelope = {
  specVersion: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId?: string | null;
  data: {
    paymentId: string;
    orderId: string;
    status: string;
    transactionId?: string;
    error?: string;
    errorCode?: string;
  };
};

const TOPIC = "payment.events";
const DEFAULT_GROUP = "pdq-orders-payment-dev";

@Injectable()
export class PaymentEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer | null = null;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService
  ) {}

  async onModuleInit() {
    const brokers = this.configService.get("KAFKA_BROKERS", "localhost:19092");
    const groupId = this.configService.get(
      "KAFKA_ORDERS_PAYMENT_CONSUMER_GROUP",
      DEFAULT_GROUP
    );

    try {
      const kafka = new Kafka({
        clientId: "pdq-orders-payment",
        brokers: brokers.split(","),
        logLevel: logLevel.WARN,
      });

      this.consumer = kafka.consumer({ groupId });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: TOPIC, fromBeginning: true });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;

          let envelope: PaymentEventEnvelope;
          try {
            envelope = JSON.parse(message.value.toString("utf-8"));
          } catch {
            console.warn("⚠️ [Orders] Skipping non-JSON payment message");
            return;
          }

          // Handle both PaymentCompleted and PaymentFailed events
          if (
            !["PaymentCompleted", "PaymentFailed"].includes(
              envelope.eventType
            ) ||
            !envelope.data?.orderId
          ) {
            return;
          }

          // Process payment result in a transaction
          await this.dataSource.transaction(async (manager) => {
            await this.ordersService.handlePaymentResult(manager, {
              consumerGroup: groupId,
              topic,
              partition,
              offset: message.offset,
              correlationId: envelope.correlationId || undefined,
              paymentId: envelope.data.paymentId,
              orderId: envelope.data.orderId,
              status:
                envelope.eventType === "PaymentCompleted"
                  ? "COMPLETED"
                  : "FAILED",
              transactionId: envelope.data.transactionId,
              error: envelope.data.error,
              errorCode: envelope.data.errorCode,
            });
          });
        },
      });

      this.isConnected = true;
      console.log(
        `✅ Orders payment consumer connected (topic: ${TOPIC}, group: ${groupId})`
      );
    } catch (e: unknown) {
      console.warn(
        "⚠️ Orders payment consumer disabled (Kafka not available):",
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
