import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { MessagingModule } from "../messaging/messaging.module";
import { OrdersModule } from "../orders/orders.module";
import { OutboxModule } from "../outbox/outbox.module";
import { OrderService } from "./application/services/order.service";
import { ShippingService } from "./application/services/shipping.service";
import { AsyncCheckoutUseCase } from "./application/use-cases/async-checkout.usecase";
import { ProcessPaymentUseCase } from "./application/use-cases/process-payment.usecase";
import { ValidateShippingUseCase } from "./application/use-cases/validate-shipping.usecase";
import { CheckoutController } from "./checkout.controller";
import { MockPaymentGateway } from "./infrastructure/gateways/mock-payment.gateway";

@Module({
  imports: [
    CartModule,
    IdempotencyModule,
    MessagingModule,
    OrdersModule,
    OutboxModule,
  ],
  controllers: [CheckoutController],
  providers: [
    // Services
    ShippingService,
    OrderService,

    // Use Cases
    ValidateShippingUseCase,
    AsyncCheckoutUseCase,
    ProcessPaymentUseCase,

    // Infrastructure
    {
      provide: "PaymentGateway",
      useClass: MockPaymentGateway,
    },
  ],
  exports: [ProcessPaymentUseCase],
})
export class CheckoutModule {}
