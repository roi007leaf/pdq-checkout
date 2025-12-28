import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxEventEntity } from "./infrastructure/entities/outbox-event.entity";
import { OutboxPublisher } from "./outbox.publisher";
import { OutboxService } from "./outbox.service";

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity])],
  providers: [OutboxService, OutboxPublisher],
  exports: [OutboxService],
})
export class OutboxModule {}
