import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../../infrastructure/repositories/order.repository';
import { NotFoundException } from '../../../../common/exceptions/domain.exceptions';

export interface OrderOutput {
  orderId: string;
  status: string;
  currency: string;
  items: Array<{
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    grandTotal: number;
  };
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GetOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(orderId: string): Promise<OrderOutput> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order', orderId);
    }

    return {
      orderId: order.id,
      status: order.status,
      currency: order.currency,
      items: order.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      totals: {
        subtotal: order.subtotal,
        tax: order.tax,
        grandTotal: order.grandTotal,
      },
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        streetAddress: order.shippingAddress.streetAddress,
        city: order.shippingAddress.city,
        stateProvince: order.shippingAddress.stateProvince,
        postalCode: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
