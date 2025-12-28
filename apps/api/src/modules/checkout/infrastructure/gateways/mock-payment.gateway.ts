import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  PaymentGateway,
  PaymentRequest,
  PaymentResult,
} from './payment-gateway.interface';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Simulate network delay
    await this.delay(500 + Math.random() * 500);

    // Simulate different scenarios based on card number
    // Card ending in 0000 = decline
    // Card ending in 9999 = network error
    // Everything else = success
    const lastFour = request.cardNumber.slice(-4);

    if (lastFour === '0000') {
      return {
        success: false,
        error: 'Card declined: Insufficient funds',
        errorCode: 'INSUFFICIENT_FUNDS',
      };
    }

    if (lastFour === '9999') {
      return {
        success: false,
        error: 'Payment gateway temporarily unavailable',
        errorCode: 'GATEWAY_ERROR',
      };
    }

    if (lastFour === '1111') {
      return {
        success: false,
        error: 'Card declined: Invalid card number',
        errorCode: 'INVALID_CARD',
      };
    }

    // Success case
    return {
      success: true,
      transactionId: `txn_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
