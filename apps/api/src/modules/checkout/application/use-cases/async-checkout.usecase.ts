import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { UseCase } from "../../../../common/application/use-case.base";
import { CartService } from "../../../cart/cart.service";
import { KafkaProducerService } from "../../../messaging/kafka-producer.service";
import { ProcessPaymentDto } from "../dtos/process-payment.dto";

export interface CheckoutResponse {
  orderId: string;
  status: "PENDING_PAYMENT";
  message: string;
  grandTotal: number;
  currency: string;
  createdAt: Date;
}

interface AsyncCheckoutContext {
  correlationId: string;
}

/**
 * Async checkout use case - delegates order creation and payment to microservices.
 *
 * Flow:
 * 1. API Gateway receives checkout request
 * 2. Generates order ID and publishes CheckoutRequested event to Kafka
 * 3. Returns immediately with order ID (PENDING_PAYMENT status)
 * 4. Orders service creates the order and requests payment
 * 5. Payment service processes payment
 * 6. Orders service receives payment result and updates order status
 * 7. Client polls for order status or receives webhook/SSE notification
 */
@Injectable()
export class AsyncCheckoutUseCase extends UseCase<
  ProcessPaymentDto,
  CheckoutResponse
> {
  constructor(
    private readonly cartService: CartService,
    private readonly kafkaProducer: KafkaProducerService
  ) {
    super(AsyncCheckoutUseCase.name);
  }

  protected async executeImpl(
    dto: ProcessPaymentDto,
    context?: AsyncCheckoutContext
  ): Promise<CheckoutResponse> {
    const cart = this.cartService.getCart();
    const orderId = uuidv4();
    const correlationId = context?.correlationId || "N/A";

    // Validate Kafka is available
    if (!this.kafkaProducer.isReady()) {
      throw new Error("Messaging service unavailable. Please try again later.");
    }

    // Build order data for the Orders microservice
    const orderData = {
      order: {
        id: orderId,
        currency: cart.currency,
        subtotal: cart.subtotal,
        tax: cart.tax,
        grandTotal: cart.grandTotal,
        items: cart.items.map((item) => ({
          productId: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.lineTotal,
        })),
        shippingAddress: {
          fullName: dto.shippingAddress.fullName,
          addressLine1: dto.shippingAddress.streetAddress,
          city: dto.shippingAddress.city,
          state: dto.shippingAddress.stateProvince,
          postalCode: dto.shippingAddress.postalCode,
          country: dto.shippingAddress.country,
        },
        paymentRequest: {
          amount: cart.grandTotal,
          currency: cart.currency,
          cardNumber: dto.paymentDetails.cardNumber,
          expiryDate: dto.paymentDetails.expiryDate,
          cvv: dto.paymentDetails.cvv,
          cardholderName: dto.paymentDetails.cardholderName,
        },
        metadata: {
          source: dto.metadata || "web",
          correlationId,
        },
      },
    };

    // Publish checkout request to Kafka
    await this.kafkaProducer.send(
      "checkout.requests",
      orderId,
      "CheckoutRequested",
      orderData,
      correlationId
    );

    this.logger.log(
      `Checkout request published for order ${orderId} (correlation: ${correlationId})`
    );

    return {
      orderId,
      status: "PENDING_PAYMENT",
      message:
        "Your order has been received and is being processed. Use the orderId to check status.",
      grandTotal: cart.grandTotal,
      currency: cart.currency,
      createdAt: new Date(),
    };
  }
}
