import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";
import { ShippingAddressDto } from "./shipping-address.dto";

export class PaymentDetailsDto {
  @IsString()
  @IsNotEmpty({ message: "Card number is required" })
  @Matches(/^[0-9]+$/, { message: "Card number must contain only digits" })
  @Length(15, 16, { message: "Card number must be 15-16 digits" })
  cardNumber: string;

  @IsString()
  @IsNotEmpty({ message: "Expiry date is required" })
  @Matches(/^(0[1-9]|1[0-2])\/[0-9]{2}$/, {
    message: "Expiry date must be in MM/YY format",
  })
  expiryDate: string;

  @IsString()
  @IsNotEmpty({ message: "CVV is required" })
  @Matches(/^[0-9]{3,4}$/, { message: "CVV must be 3-4 digits" })
  cvv: string;

  @IsString()
  @IsNotEmpty({ message: "Cardholder name is required" })
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
