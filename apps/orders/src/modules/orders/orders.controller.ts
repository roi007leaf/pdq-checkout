import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    const order = await this.ordersService.getOrder(id);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return {
      id: order.id,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      tax: order.tax,
      grandTotal: order.grandTotal,
      paymentId: order.paymentId,
      items: order.items?.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      shippingAddress: order.shippingAddress
        ? {
            fullName: order.shippingAddress.fullName,
            addressLine1: order.shippingAddress.addressLine1,
            addressLine2: order.shippingAddress.addressLine2,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            postalCode: order.shippingAddress.postalCode,
            country: order.shippingAddress.country,
          }
        : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
