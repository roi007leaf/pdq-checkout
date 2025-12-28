import { Inject, Injectable } from "@nestjs/common";
import { UseCase } from "../../../../common/application/use-case.base";
import { PaymentFailedException } from "../../../../common/exceptions/domain.exceptions";
import { CartService } from "../../../cart/cart.service";
import { OrderStatus } from "../../../orders/infrastructure/entities/order.entity";
import { PaymentGateway } from "../../infrastructure/gateways/payment-gateway.interface";
import { ProcessPaymentDto } from "../dtos/process-payment.dto";
import { OrderService } from "../services/order.service";

export interface PaymentResponse {
  orderId: string;
  status: OrderStatus;
  grandTotal: number;
  currency: string;
  createdAt: Date;
  replayed?: boolean;
}

interface ProcessPaymentContext {
  correlationId: string;
}

@Injectable()
export class ProcessPaymentUseCase extends UseCase<
  ProcessPaymentDto,
  PaymentResponse
> {
  constructor(
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    @Inject("PaymentGateway") private readonly paymentGateway: PaymentGateway
  ) {
    super(ProcessPaymentUseCase.name);
  }

  protected async executeImpl(
    dto: ProcessPaymentDto,
    context?: ProcessPaymentContext
  ): Promise<PaymentResponse> {
    const cart = this.cartService.getCart();
    const correlationId = context?.correlationId || "N/A";

    // Step 1: Process payment through payment gateway service
    const paymentResult = await this.paymentGateway.processPayment({
      amount: cart.grandTotal,
      currency: cart.currency,
      cardNumber: dto.paymentDetails.cardNumber,
      expiryDate: dto.paymentDetails.expiryDate,
      cvv: dto.paymentDetails.cvv,
      cardholderName: dto.paymentDetails.cardholderName,
    });

    if (!paymentResult.success) {
      throw new PaymentFailedException(
        paymentResult.error || "Payment was declined"
      );
    }

    // Step 2: Create order through order service
    const order = await this.orderService.createOrderWithOutbox({
      dto,
      cartData: {
        items: cart.items,
        subtotal: cart.subtotal,
        tax: cart.tax,
        grandTotal: cart.grandTotal,
        currency: cart.currency,
      },
      paymentResult,
      correlationId,
    });

    return {
      orderId: order.id,
      status: order.status,
      grandTotal: order.grandTotal,
      currency: order.currency,
      createdAt: order.createdAt,
    };
  }
}
