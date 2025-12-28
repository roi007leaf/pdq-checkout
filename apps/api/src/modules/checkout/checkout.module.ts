import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutController } from './checkout.controller';
import { ValidateShippingUseCase } from './application/use-cases/validate-shipping.usecase';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.usecase';
import { MockPaymentGateway } from './infrastructure/gateways/mock-payment.gateway';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    CartModule,
    OrdersModule,
    IdempotencyModule,
    OutboxModule,
  ],
  controllers: [CheckoutController],
  providers: [
    ValidateShippingUseCase,
    ProcessPaymentUseCase,
    {
      provide: 'PaymentGateway',
      useClass: MockPaymentGateway,
    },
  ],
})
export class CheckoutModule {}
