import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConsumerInboxEntity } from "./infrastructure/entities/consumer-inbox.entity";
import { OutboxEventEntity } from "./infrastructure/entities/outbox-event.entity";
import { PaymentTransactionEntity } from "./infrastructure/entities/payment-transaction.entity";
import { OutboxPublisher } from "./outbox.publisher";
import { PaymentEventsConsumer } from "./payment-events.consumer";
import { PaymentService } from "./payment.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransactionEntity,
      ConsumerInboxEntity,
      OutboxEventEntity,
    ]),
  ],
  providers: [PaymentService, PaymentEventsConsumer, OutboxPublisher],
  exports: [PaymentService],
})
export class PaymentModule {}
