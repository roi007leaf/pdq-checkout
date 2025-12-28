import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Consumer, Kafka, logLevel } from "kafkajs";
import { DataSource } from "typeorm";
import { OrdersService } from "./orders.service";

/**
 * Kafka message envelope for order creation requests from API gateway
 */
type OrderRequestEnvelope = {
  specVersion: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId?: string | null;
  data: {
    order: {
      id: string;
      currency: string;
      subtotal: number;
      tax: number;
      grandTotal: number;
      items: Array<{
        productId: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      shippingAddress: {
        fullName: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        phone?: string;
      };
      paymentRequest: {
        amount: number;
        currency: string;
        cardNumber: string;
        expiryDate: string;
        cvv: string;
        cardholderName: string;
      };
      metadata?: Record<string, unknown>;
    };
  };
};

const TOPIC = "checkout.requests";
const DEFAULT_GROUP = "pdq-orders-dev";

@Injectable()
export class OrderEventsConsumer implements OnModuleInit, OnModuleDestroy {
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
      "KAFKA_ORDERS_CONSUMER_GROUP",
      DEFAULT_GROUP
    );

    try {
      const kafka = new Kafka({
        clientId: "pdq-orders",
        brokers: brokers.split(","),
        logLevel: logLevel.WARN,
      });

      this.consumer = kafka.consumer({ groupId });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: TOPIC, fromBeginning: true });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;

          let envelope: OrderRequestEnvelope;
          try {
            envelope = JSON.parse(message.value.toString("utf-8"));
          } catch {
            console.warn("⚠️ [Orders] Skipping non-JSON message");
            return;
          }

          if (
            envelope.eventType !== "CheckoutRequested" ||
            !envelope.data?.order?.id
          ) {
            return;
          }

          // Process order creation in a transaction
          await this.dataSource.transaction(async (manager) => {
            await this.ordersService.createOrder(manager, {
              consumerGroup: groupId,
              topic,
              partition,
              offset: message.offset,
              correlationId: envelope.correlationId || undefined,
              order: envelope.data.order,
            });
          });
        },
      });

      this.isConnected = true;
      console.log(
        `✅ Orders consumer connected (topic: ${TOPIC}, group: ${groupId})`
      );
    } catch (e: unknown) {
      console.warn(
        "⚠️ Orders consumer disabled (Kafka not available):",
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
