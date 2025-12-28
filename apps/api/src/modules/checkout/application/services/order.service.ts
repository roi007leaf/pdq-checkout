import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { OrderItemEntity } from "../../../orders/infrastructure/entities/order-item.entity";
import {
  OrderEntity,
  OrderStatus,
} from "../../../orders/infrastructure/entities/order.entity";
import { ShippingAddressEntity } from "../../../orders/infrastructure/entities/shipping-address.entity";
import { OrderRepository } from "../../../orders/infrastructure/repositories/order.repository";
import { OutboxService } from "../../../outbox/outbox.service";
import { ProcessPaymentDto } from "../dtos/process-payment.dto";

export interface CreateOrderInput {
  dto: ProcessPaymentDto;
  cartData: {
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    subtotal: number;
    tax: number;
    grandTotal: number;
    currency: string;
  };
  paymentResult: {
    transactionId?: string;
    [key: string]: any;
  };
  correlationId: string;
}

/**
 * Service responsible for order creation and management.
 * Handles the persistence of orders and related entities.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Creates an order with all related entities in a transaction.
   * Also creates an outbox event for downstream processing.
   */
  async createOrderWithOutbox(input: CreateOrderInput): Promise<OrderEntity> {
    return await this.dataSource.transaction(async (manager) => {
      const orderId = uuidv4();

      // Create shipping address
      const shippingAddress = manager.create(ShippingAddressEntity, {
        fullName: input.dto.shippingAddress.fullName,
        streetAddress: input.dto.shippingAddress.streetAddress,
        city: input.dto.shippingAddress.city,
        stateProvince: input.dto.shippingAddress.stateProvince,
        postalCode: input.dto.shippingAddress.postalCode,
        country: input.dto.shippingAddress.country,
      });
      await manager.save(shippingAddress);

      // Create order items
      const orderItems = input.cartData.items.map((item) =>
        manager.create(OrderItemEntity, {
          orderId,
          productId: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.lineTotal,
        })
      );
      await manager.save(orderItems);

      // Create order
      const order = manager.create(OrderEntity, {
        id: orderId,
        status: OrderStatus.CONFIRMED,
        currency: input.cartData.currency,
        subtotal: input.cartData.subtotal,
        tax: input.cartData.tax,
        grandTotal: input.cartData.grandTotal,
        shippingAddressId: shippingAddress.id,
        shippingAddress,
        items: orderItems,
      });
      await manager.save(order);

      // Create outbox event for OrderCreated
      await this.outboxService.createEvent(
        manager,
        "Order",
        order.id,
        "OrderCreated",
        {
          orderId: order.id,
          status: order.status,
          items: input.cartData.items,
          shippingAddress: input.dto.shippingAddress,
          totals: {
            subtotal: order.subtotal,
            tax: order.tax,
            grandTotal: order.grandTotal,
          },
          currency: order.currency,
          paymentTransactionId: input.paymentResult.transactionId || "N/A",
          createdAt: order.createdAt,
        },
        {
          correlationId: input.correlationId,
          source: "checkout-service",
        }
      );

      return order;
    });
  }

  /**
   * Retrieves an order by ID.
   */
  async getOrderById(orderId: string): Promise<OrderEntity | null> {
    return await this.orderRepository.findById(orderId);
  }

  /**
   * Updates order status.
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    order.status = status;
    await this.orderRepository.save(order);
  }
}
