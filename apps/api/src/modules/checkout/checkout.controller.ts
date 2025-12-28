import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  HttpStatus as NestHttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { getCorrelationId } from "../../common/middleware/correlation-id.middleware";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { ProcessPaymentDto } from "./application/dtos/process-payment.dto";
import { ShippingAddressDto } from "./application/dtos/shipping-address.dto";
import {
  AsyncCheckoutUseCase,
  CheckoutResponse,
} from "./application/use-cases/async-checkout.usecase";
import { ValidateShippingUseCase } from "./application/use-cases/validate-shipping.usecase";

const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

@Controller("checkout")
export class CheckoutController {
  constructor(
    private readonly validateShippingUseCase: ValidateShippingUseCase,
    private readonly asyncCheckoutUseCase: AsyncCheckoutUseCase,
    private readonly idempotencyService: IdempotencyService
  ) {}

  @Post("shipping")
  @HttpCode(HttpStatus.OK)
  async validateShipping(@Body() dto: ShippingAddressDto) {
    return this.validateShippingUseCase.execute(dto);
  }

  /**
   * Process checkout asynchronously via microservices.
   * Publishes CheckoutRequested event to Kafka and returns PENDING_PAYMENT status.
   * Client should poll GET /orders/:id to check for completion.
   */
  @Post("payment")
  @HttpCode(HttpStatus.CREATED)
  async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
    @Req() req: Request
  ): Promise<CheckoutResponse & { replayed?: boolean }> {
    // Require idempotency key
    if (!idempotencyKey) {
      throw new HttpException(
        {
          code: "MISSING_IDEMPOTENCY_KEY",
          title: "Missing Idempotency Key",
          detail: "The Idempotency-Key header is required for this operation",
        },
        NestHttpStatus.BAD_REQUEST
      );
    }

    const correlationId = getCorrelationId(req);
    const scope = "POST:/api/checkout/payment";

    // Check idempotency
    const idempotencyResult = await this.idempotencyService.checkOrCreate(
      idempotencyKey,
      scope,
      dto
    );

    // If already completed, return cached response
    if (
      idempotencyResult.status === "COMPLETED" &&
      idempotencyResult.response
    ) {
      return {
        ...(idempotencyResult.response as unknown as CheckoutResponse),
        replayed: true,
      };
    }

    // If in progress by another request, reject
    if (
      idempotencyResult.status === "IN_PROGRESS" &&
      !idempotencyResult.isNew
    ) {
      throw new HttpException(
        {
          code: "REQUEST_IN_PROGRESS",
          title: "Request In Progress",
          detail: "This request is already being processed. Please wait.",
        },
        NestHttpStatus.CONFLICT
      );
    }

    try {
      const result = await this.asyncCheckoutUseCase.execute(dto, {
        correlationId,
      });

      // Mark idempotency as completed
      await this.idempotencyService.markCompleted(
        idempotencyKey,
        scope,
        HttpStatus.CREATED,
        result
      );

      return result;
    } catch (error) {
      // Mark idempotency as failed
      await this.idempotencyService.markFailed(idempotencyKey, scope);
      throw error;
    }
  }
}
