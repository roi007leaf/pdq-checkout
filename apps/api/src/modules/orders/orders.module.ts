import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './infrastructure/entities/order.entity';
import { OrderItemEntity } from './infrastructure/entities/order-item.entity';
import { ShippingAddressEntity } from './infrastructure/entities/shipping-address.entity';
import { OrderRepository } from './infrastructure/repositories/order.repository';
import { OrdersController } from './orders.controller';
import { GetOrderUseCase } from './application/use-cases/get-order.usecase';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ShippingAddressEntity,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrderRepository, GetOrderUseCase],
  exports: [OrderRepository],
})
export class OrdersModule {}
