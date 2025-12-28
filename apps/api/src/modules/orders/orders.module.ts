import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GetOrderUseCase } from "./application/use-cases/get-order.usecase";
import { OrderItemEntity } from "./infrastructure/entities/order-item.entity";
import { OrderEntity } from "./infrastructure/entities/order.entity";
import { ShippingAddressEntity } from "./infrastructure/entities/shipping-address.entity";
import { OrderRepository } from "./infrastructure/repositories/order.repository";
import { OrdersController } from "./orders.controller";

/**
 * Orders module in API Gateway - proxies GET /orders/:id to Orders microservice.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ShippingAddressEntity,
    ]),
  ],
  controllers: [OrdersController],
  providers: [GetOrderUseCase, OrderRepository],
  exports: [OrderRepository],
})
export class OrdersModule {}
