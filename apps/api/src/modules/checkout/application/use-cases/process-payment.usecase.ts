import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcessPaymentDto } from '../dtos/process-payment.dto';
import { CartService } from '../../../cart/cart.service';
import { OrderRepository } from '../../../orders/infrastructure/repositories/order.repository';
import { OutboxService } from '../../../outbox/outbox.service';
import { PaymentGateway, PaymentResult } from '../../infrastructure/gateways/payment-gateway.interface';
import { OrderEntity, OrderStatus } from '../../../orders/infrastructure/entities/order.entity';
import { OrderItemEntity } from '../../../orders/infrastructure/entities/order-item.entity';
import { ShippingAddressEntity } from '../../../orders/infrastructure/entities/shipping-address.entity';
import { PaymentFailedException } from '../../../../common/exceptions/domain.exceptions';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentResponse {
  orderId: string;
  status: OrderStatus;
  grandTotal: number;
  currency: string;
  createdAt: Date;
  replayed?: boolean;
}

@Injectable()
export class ProcessPaymentUseCase {
  constructor(
    private readonly cartService: CartService,
    private readonly orderRepository: OrderRepository,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    @Inject('PaymentGateway') private readonly paymentGateway: PaymentGateway,
  ) {}

  async execute(dto: ProcessPaymentDto, correlationId: string): Promise<PaymentResponse> {
    const cart = this.cartService.getCart();
    
    // Process payment through gateway
    const paymentResult = await this.paymentGateway.processPayment({
      amount: cart.grandTotal,
      currency: cart.currency,
      cardNumber: dto.paymentDetails.cardNumber,
      expiryDate: dto.paymentDetails.expiryDate,
      cvv: dto.paymentDetails.cvv,
      cardholderName: dto.paymentDetails.cardholderName,
    });

    if (!paymentResult.success) {
      throw new PaymentFailedException(paymentResult.error || 'Payment was declined');
    }

    // Create order in a transaction with outbox event
    const order = await this.createOrderWithOutbox(dto, cart, paymentResult, correlationId);

    return {
      orderId: order.id,
      status: order.status,
      grandTotal: order.grandTotal,
      currency: order.currency,
      createdAt: order.createdAt,
    };
  }

  private async createOrderWithOutbox(
    dto: ProcessPaymentDto,
    cart: ReturnType<CartService['getCart']>,
    paymentResult: PaymentResult,
    correlationId: string,
  ): Promise<OrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const orderId = uuidv4();

      // Create order entity
      const order = manager.create(OrderEntity, {
        id: orderId,
        status: OrderStatus.CONFIRMED,
        currency: cart.currency,
        subtotal: cart.subtotal,
        tax: cart.tax,
        grandTotal: cart.grandTotal,
        metadata: {
          paymentTransactionId: paymentResult.transactionId,
          source: dto.metadata || 'web',
        },
      });

      // Create order items
      order.items = cart.items.map((item) =>
        manager.create(OrderItemEntity, {
          orderId,
          sku: item.sku,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        }),
      );

      // Create shipping address
      order.shippingAddress = manager.create(ShippingAddressEntity, {
        orderId,
        fullName: dto.shippingAddress.fullName,
        streetAddress: dto.shippingAddress.streetAddress,
        city: dto.shippingAddress.city,
        stateProvince: dto.shippingAddress.stateProvince,
        postalCode: dto.shippingAddress.postalCode,
        country: dto.shippingAddress.country,
      });

      // Save order (cascades to items and address)
      const savedOrder = await manager.save(order);

      // Create outbox event in same transaction
      await this.outboxService.createEvent(
        manager,
        'order',
        savedOrder.id,
        'OrderCreated',
        {
          orderId: savedOrder.id,
          status: savedOrder.status,
          currency: savedOrder.currency,
          totals: {
            subtotal: savedOrder.subtotal,
            tax: savedOrder.tax,
            grandTotal: savedOrder.grandTotal,
          },
          items: savedOrder.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
          shippingAddress: {
            fullName: savedOrder.shippingAddress.fullName,
            city: savedOrder.shippingAddress.city,
            country: savedOrder.shippingAddress.country,
          },
          createdAt: savedOrder.createdAt.toISOString(),
        },
        { correlationId },
      );

      return savedOrder;
    });
  }
}
