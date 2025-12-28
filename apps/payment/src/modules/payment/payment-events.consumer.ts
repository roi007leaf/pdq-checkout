import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Consumer, Kafka, logLevel } from "kafkajs";
import { DataSource } from "typeorm";
import { PaymentService } from "./payment.service";

/**
 * Kafka message envelope for payment requests
 */
type PaymentRequestEnvelope = {
  specVersion: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId?: string | null;
  data: {
    orderId: string;
    paymentRequest: {
      amount: number;
      currency: string;
      cardNumber: string;
      expiryDate: string;
      cvv: string;
      cardholderName: string;
    };
    [k: string]: unknown;
  };
};

const TOPIC = "payment.requests";
const DEFAULT_GROUP = "pdq-payment-dev";

@Injectable()
export class PaymentEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer | null = null;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly paymentService: PaymentService
  ) {}

  async onModuleInit() {
    const brokers = this.configService.get("KAFKA_BROKERS", "localhost:19092");
    const groupId = this.configService.get(
      "KAFKA_PAYMENT_CONSUMER_GROUP",
      DEFAULT_GROUP
    );

    try {
      const kafka = new Kafka({
        clientId: "pdq-payment",
        brokers: brokers.split(","),
        logLevel: logLevel.WARN,
      });

      this.consumer = kafka.consumer({ groupId });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: TOPIC, fromBeginning: true });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;

          let envelope: PaymentRequestEnvelope;
          try {
            envelope = JSON.parse(message.value.toString("utf-8"));
          } catch {
            console.warn("⚠️ [Payment] Skipping non-JSON message");
            return;
          }

          if (
            envelope.eventType !== "PaymentRequested" ||
            !envelope.data?.orderId
          ) {
            return;
          }

          // Process payment in a transaction
          await this.dataSource.transaction(async (manager) => {
            await this.paymentService.processPayment(manager, {
              consumerGroup: groupId,
              topic,
              partition,
              offset: message.offset,
              orderId: envelope.data.orderId,
              correlationId: envelope.correlationId || undefined,
              paymentRequest: envelope.data.paymentRequest,
            });
          });
        },
      });

      this.isConnected = true;
      console.log(
        `✅ Payment consumer connected (topic: ${TOPIC}, group: ${groupId})`
      );
    } catch (e: unknown) {
      console.warn(
        "⚠️ Payment consumer disabled (Kafka not available):",
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
