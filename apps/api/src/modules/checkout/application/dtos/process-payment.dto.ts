import { IsString, IsNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingAddressDto } from './shipping-address.dto';

export class PaymentDetailsDto {
  @IsString()
  @IsNotEmpty({ message: 'Card number is required' })
  cardNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Expiry date is required' })
  expiryDate: string;

  @IsString()
  @IsNotEmpty({ message: 'CVV is required' })
  cvv: string;

  @IsString()
  @IsNotEmpty({ message: 'Cardholder name is required' })
  cardholderName: string;
}

export class ProcessPaymentDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  paymentDetails: PaymentDetailsDto;

  @IsString()
  @IsOptional()
  metadata?: string;
}
