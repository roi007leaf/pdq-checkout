import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ConsumerInboxEntity } from "./infrastructure/entities/consumer-inbox.entity";
import { OrderItemEntity } from "./infrastructure/entities/order-item.entity";
import {
  OrderEntity,
  OrderStatus,
} from "./infrastructure/entities/order.entity";
import {
  OutboxEventEntity,
  OutboxStatus,
} from "./infrastructure/entities/outbox-event.entity";
import { ShippingAddressEntity } from "./infrastructure/entities/shipping-address.entity";

export interface CreateOrderInput {
  consumerGroup: string;
  topic: string;
  partition: number;
  offset: string;
  correlationId?: string;
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
}

export interface PaymentResultInput {
  consumerGroup: string;
  topic: string;
  partition: number;
  offset: string;
  correlationId?: string;
  paymentId: string;
  orderId: string;
  status: "COMPLETED" | "FAILED";
  transactionId?: string;
  error?: string;
  errorCode?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>
  ) {}

  /**
   * Idempotent order creation - uses consumer inbox pattern.
   */
  async createOrder(
    manager: EntityManager,
    input: CreateOrderInput
  ): Promise<{ processed: boolean; orderId?: string }> {
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
        return { processed: false, orderId: input.order.id };
      }
      throw e;
    }

    // 2. Create shipping address
    const shippingAddress = manager.create(ShippingAddressEntity, {
      fullName: input.order.shippingAddress.fullName,
      addressLine1: input.order.shippingAddress.addressLine1,
      addressLine2: input.order.shippingAddress.addressLine2 || null,
      city: input.order.shippingAddress.city,
      state: input.order.shippingAddress.state,
      postalCode: input.order.shippingAddress.postalCode,
      country: input.order.shippingAddress.country,
      phone: input.order.shippingAddress.phone || null,
    });

    // 3. Create order items
    const orderItems = input.order.items.map((item) =>
      manager.create(OrderItemEntity, {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })
    );

    // 4. Create the order
    const order = manager.create(OrderEntity, {
      id: input.order.id,
      status: OrderStatus.PENDING_PAYMENT,
      currency: input.order.currency,
      subtotal: input.order.subtotal,
      tax: input.order.tax,
      grandTotal: input.order.grandTotal,
      metadata: input.order.metadata || {},
      items: orderItems,
      shippingAddress,
    });

    await manager.save(order);

    // 5. Create outbox event to request payment
    const paymentRequestEvent = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType: "Order",
      aggregateId: order.id,
      eventType: "PaymentRequested",
      eventVersion: 1,
      payload: {
        orderId: order.id,
        paymentRequest: input.order.paymentRequest,
      },
      headers: {
        correlationId: input.correlationId,
      },
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    await manager.save(paymentRequestEvent);

    // 6. Create outbox event for order created
    const orderCreatedEvent = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType: "Order",
      aggregateId: order.id,
      eventType: "OrderCreated",
      eventVersion: 1,
      payload: {
        orderId: order.id,
        status: order.status,
        currency: order.currency,
        subtotal: order.subtotal,
        tax: order.tax,
        grandTotal: order.grandTotal,
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        shippingAddress: {
          fullName: shippingAddress.fullName,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
      },
      headers: {
        correlationId: input.correlationId,
      },
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    await manager.save(orderCreatedEvent);

    console.log(`✅ Order ${order.id} created with status ${order.status}`);

    return { processed: true, orderId: order.id };
  }

  /**
   * Handle payment result - update order status based on payment outcome.
   */
  async handlePaymentResult(
    manager: EntityManager,
    input: PaymentResultInput
  ): Promise<{ processed: boolean }> {
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
        return { processed: false };
      }
      throw e;
    }

    // 2. Find the order
    const order = await manager.findOne(OrderEntity, {
      where: { id: input.orderId },
    });

    if (!order) {
      console.warn(`⚠️ Order ${input.orderId} not found for payment result`);
      return { processed: true }; // Mark as processed to avoid retries
    }

    // 3. Update order based on payment status
    if (input.status === "COMPLETED") {
      order.status = OrderStatus.CONFIRMED;
      order.paymentId = input.paymentId;
      order.paymentTransactionId = input.transactionId || null;
    } else {
      order.status = OrderStatus.PAYMENT_FAILED;
      order.metadata = {
        ...order.metadata,
        paymentError: input.error,
        paymentErrorCode: input.errorCode,
      };
    }

    await manager.save(order);

    // 4. Create outbox event for order status change
    const eventType =
      input.status === "COMPLETED" ? "OrderConfirmed" : "OrderPaymentFailed";

    const statusEvent = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType: "Order",
      aggregateId: order.id,
      eventType,
      eventVersion: 1,
      payload: {
        orderId: order.id,
        status: order.status,
        paymentId: order.paymentId,
        transactionId: order.paymentTransactionId,
        error: input.error,
        errorCode: input.errorCode,
      },
      headers: {
        correlationId: input.correlationId,
      },
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    await manager.save(statusEvent);

    console.log(`✅ Order ${order.id} updated to ${order.status}`);

    return { processed: true };
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { id: orderId },
      relations: ["items", "shippingAddress"],
    });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    manager: EntityManager,
    orderId: string,
    status: OrderStatus,
    correlationId?: string
  ): Promise<OrderEntity | null> {
    const order = await manager.findOne(OrderEntity, {
      where: { id: orderId },
    });

    if (!order) return null;

    const previousStatus = order.status;
    order.status = status;
    await manager.save(order);

    // Create outbox event
    const statusEvent = manager.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateType: "Order",
      aggregateId: order.id,
      eventType: "OrderStatusChanged",
      eventVersion: 1,
      payload: {
        orderId: order.id,
        previousStatus,
        newStatus: status,
      },
      headers: {
        correlationId,
      },
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
    });

    await manager.save(statusEvent);

    return order;
  }
}
