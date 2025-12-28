import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  @MinLength(5, { message: 'Street address must be at least 5 characters' })
  @MaxLength(500, { message: 'Street address must not exceed 500 characters' })
  streetAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  @MinLength(2, { message: 'City must be at least 2 characters' })
  @MaxLength(100, { message: 'City must not exceed 100 characters' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'State/Province is required' })
  @MinLength(2, { message: 'State/Province must be at least 2 characters' })
  @MaxLength(100, { message: 'State/Province must not exceed 100 characters' })
  stateProvince: string;

  @IsString()
  @IsNotEmpty({ message: 'Postal code is required' })
  @Matches(/^[A-Za-z0-9\s\-]{3,20}$/, {
    message: 'Postal code format is invalid',
  })
  postalCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  @MinLength(2, { message: 'Country must be at least 2 characters' })
  @MaxLength(100, { message: 'Country must not exceed 100 characters' })
  country: string;
}
