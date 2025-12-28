import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ConsumerInboxEntity } from "./infrastructure/entities/consumer-inbox.entity";
import {
  OutboxEventEntity,
  OutboxStatus,
} from "./infrastructure/entities/outbox-event.entity";
import {
  PaymentStatus,
  PaymentTransactionEntity,
} from "./infrastructure/entities/payment-transaction.entity";

export interface PaymentRequest {
  amount: number;
  currency: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

export interface ProcessPaymentInput {
  consumerGroup: string;
  topic: string;
  partition: number;
  offset: string;
  orderId: string;
  correlationId?: string;
  paymentRequest: PaymentRequest;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  paymentId: string;
  error?: string;
  errorCode?: string;
}

@Injectable()
export class PaymentService {
  /**
   * Idempotent payment processing - uses consumer inbox pattern.
   * If the message was already processed, returns cached result.
   */
  async processPayment(
    manager: EntityManager,
    input: ProcessPaymentInput
  ): Promise<{ processed: boolean; result?: PaymentResult }> {
    // 1. Check consumer inbox for idempotency
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
        // Message already processed - find existing payment
        const existing = await manager.findOne(PaymentTransactionEntity, {
          where: { orderId: input.orderId },
        });

        if (existing) {
          return {
            processed: false,
            result: {
              success: existing.status === PaymentStatus.COMPLETED,
              transactionId: existing.transactionId || undefined,
              paymentId: existing.id,
              error: existing.errorMessage || undefined,
              errorCode: existing.errorCode || undefined,
            },
          };
        }
        return { processed: false };
      }
      throw e;
    }

    // 2. Process the payment (simulate external gateway call)
    const paymentResult = await this.executePayment(input.paymentRequest);
    const paymentId = uuidv4();

    // 3. Store payment transaction
    const payment = manager.create(PaymentTransactionEntity, {
      id: paymentId,
      orderId: input.orderId,
      status: paymentResult.success
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED,
      amount: input.paymentRequest.amount,
      currency: input.paymentRequest.currency,
      transactionId: paymentResult.transactionId || null,
      errorMessage: paymentResult.error || null,
      errorCode: paymentResult.errorCode || null,
      paymentMethod: {
        type: "card",
        last4: input.paymentRequest.cardNumber.slice(-4),
      },
    });

    await manager.save(payment);

    // 4. Create outbox event for downstream consumers
    const eventType = paymentResult.success
      ? "PaymentCompleted"
      : "PaymentFailed";

    const outboxEvent = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType: "Payment",
      aggregateId: paymentId,
      eventType,
      eventVersion: 1,
      payload: {
        paymentId,
        orderId: input.orderId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        error: payment.errorMessage,
        errorCode: payment.errorCode,
      },
      headers: {
        correlationId: input.correlationId,
      },
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    await manager.save(outboxEvent);

    console.log(
      `✅ Payment ${paymentId} processed for order ${input.orderId}: ${eventType}`
    );

    return {
      processed: true,
      result: {
        success: paymentResult.success,
        transactionId: paymentResult.transactionId,
        paymentId,
        error: paymentResult.error,
        errorCode: paymentResult.errorCode,
      },
    };
  }

  /**
   * Mock payment gateway - simulates external payment processing.
   * In production, this would call Stripe, Adyen, etc.
   */
  private async executePayment(
    request: PaymentRequest
  ): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
    errorCode?: string;
  }> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate different card behaviors for testing
    const last4 = request.cardNumber.slice(-4);

    console.log(
      `[PaymentService] Processing payment: { last4: '${last4}', amount: ${request.amount} }`
    );

    if (last4 === "0000") {
      return {
        success: false,
        error: "Insufficient funds",
        errorCode: "INSUFFICIENT_FUNDS",
      };
    }

    if (last4 === "1111") {
      return {
        success: false,
        error: "Invalid card",
        errorCode: "INVALID_CARD",
      };
    }

    if (last4 === "9999") {
      return {
        success: false,
        error: "Payment gateway temporarily unavailable",
        errorCode: "GATEWAY_ERROR",
      };
    }

    // Success case
    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`,
    };
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(
    manager: EntityManager,
    orderId: string
  ): Promise<PaymentTransactionEntity | null> {
    return manager.findOne(PaymentTransactionEntity, {
      where: { orderId },
    });
  }

  /**
   * Process refund for a payment
   */
  async refundPayment(
    manager: EntityManager,
    paymentId: string,
    correlationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const payment = await manager.findOne(PaymentTransactionEntity, {
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      return { success: false, error: "Payment cannot be refunded" };
    }

    // Update payment status
    payment.status = PaymentStatus.REFUNDED;
    await manager.save(payment);

    // Create outbox event
    const outboxEvent = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType: "Payment",
      aggregateId: paymentId,
      eventType: "PaymentRefunded",
      eventVersion: 1,
      payload: {
        paymentId,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
      },
      headers: {
        correlationId,
      },
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    await manager.save(outboxEvent);

    return { success: true };
  }
}
