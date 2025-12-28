import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumerInboxEntity } from './infrastructure/entities/consumer-inbox.entity';
import { FulfillmentTaskEntity } from './infrastructure/entities/fulfillment-task.entity';
import { FulfillmentService } from './fulfillment.service';
import { OrderEventsConsumer } from './order-events.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([ConsumerInboxEntity, FulfillmentTaskEntity])],
  providers: [FulfillmentService, OrderEventsConsumer],
})
export class FulfillmentModule {}
