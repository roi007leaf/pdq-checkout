import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConsumerInboxEntity } from "./infrastructure/entities/consumer-inbox.entity";
import { OrderItemEntity } from "./infrastructure/entities/order-item.entity";
import { OrderEntity } from "./infrastructure/entities/order.entity";
import { OutboxEventEntity } from "./infrastructure/entities/outbox-event.entity";
import { ShippingAddressEntity } from "./infrastructure/entities/shipping-address.entity";
import { OrderEventsConsumer } from "./order-events.consumer";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OutboxPublisher } from "./outbox.publisher";
import { PaymentEventsConsumer } from "./payment-events.consumer";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ShippingAddressEntity,
      ConsumerInboxEntity,
      OutboxEventEntity,
    ]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderEventsConsumer,
    PaymentEventsConsumer,
    OutboxPublisher,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
