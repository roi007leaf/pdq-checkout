import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ValidateShippingUseCase } from './application/use-cases/validate-shipping.usecase';
import { ProcessPaymentUseCase, PaymentResponse } from './application/use-cases/process-payment.usecase';
import { ShippingAddressDto } from './application/dtos/shipping-address.dto';
import { ProcessPaymentDto } from './application/dtos/process-payment.dto';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { getCorrelationId } from '../../common/middleware/correlation-id.middleware';
import { DomainException } from '../../common/exceptions/domain.exceptions';
import { HttpException, HttpStatus as NestHttpStatus } from '@nestjs/common';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly validateShippingUseCase: ValidateShippingUseCase,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('shipping')
  @HttpCode(HttpStatus.OK)
  async validateShipping(@Body() dto: ShippingAddressDto) {
    return this.validateShippingUseCase.execute(dto);
  }

  @Post('payment')
  @HttpCode(HttpStatus.CREATED)
  async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
    @Req() req: Request,
  ): Promise<PaymentResponse & { replayed?: boolean }> {
    // Require idempotency key
    if (!idempotencyKey) {
      throw new HttpException(
        {
          code: 'MISSING_IDEMPOTENCY_KEY',
          title: 'Missing Idempotency Key',
          detail: 'The Idempotency-Key header is required for this operation',
        },
        NestHttpStatus.BAD_REQUEST,
      );
    }

    const correlationId = getCorrelationId(req);
    const scope = 'POST:/api/checkout/payment';

    // Check idempotency
    const idempotencyResult = await this.idempotencyService.checkOrCreate(
      idempotencyKey,
      scope,
      dto,
    );

    // If already completed, return cached response
    if (idempotencyResult.status === 'COMPLETED' && idempotencyResult.response) {
      return {
        ...(idempotencyResult.response as PaymentResponse),
        replayed: true,
      };
    }

    // If in progress by another request, reject
    if (idempotencyResult.status === 'IN_PROGRESS' && !idempotencyResult.isNew) {
      throw new HttpException(
        {
          code: 'REQUEST_IN_PROGRESS',
          title: 'Request In Progress',
          detail: 'This request is already being processed. Please wait.',
        },
        NestHttpStatus.CONFLICT,
      );
    }

    try {
      // Process the payment
      const result = await this.processPaymentUseCase.execute(dto, correlationId);

      // Mark idempotency as completed
      await this.idempotencyService.markCompleted(
        idempotencyKey,
        scope,
        HttpStatus.CREATED,
        result,
      );

      return result;
    } catch (error) {
      // Mark idempotency as failed
      await this.idempotencyService.markFailed(idempotencyKey, scope);
      throw error;
    }
  }
}
