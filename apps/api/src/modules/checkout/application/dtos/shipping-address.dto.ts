import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

// Supported countries with their display names
const VALID_COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Belgium",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Ireland",
  "New Zealand",
  "Japan",
  "Singapore",
] as const;

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty({ message: "Full name is required" })
  @MinLength(3, { message: "Full name must be at least 3 characters" })
  @MaxLength(100, { message: "Full name must not exceed 100 characters" })
  @Matches(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/, {
    message:
      "Full name must include first and last name with proper capitalization",
  })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: "Street address is required" })
  @MinLength(5, { message: "Street address must be at least 5 characters" })
  @MaxLength(200, { message: "Street address must not exceed 200 characters" })
  @Matches(/^\d+\s+[A-Za-z0-9\s,.-]+$/, {
    message:
      "Street address must start with a number followed by street name (e.g., '123 Main St')",
  })
  streetAddress: string;

  @IsString()
  @IsNotEmpty({ message: "City is required" })
  @MinLength(2, { message: "City must be at least 2 characters" })
  @MaxLength(100, { message: "City must not exceed 100 characters" })
  @Matches(/^[A-Z][a-zA-Z\s.'-]+$/, {
    message: "City must start with a capital letter and contain only letters",
  })
  city: string;

  @IsString()
  @IsNotEmpty({ message: "State/Province is required" })
  @MaxLength(100, { message: "State/Province must not exceed 100 characters" })
  @Matches(/^[A-Z]{2}$|^[A-Z][a-zA-Z\s.'-]+$/, {
    message:
      "State/Province must be either a 2-letter code (e.g., 'CA', 'NY') or full name",
  })
  stateProvince: string;

  @IsString()
  @IsNotEmpty({ message: "Postal code is required" })
  // US ZIP: 12345 or 12345-6789
  @ValidateIf((o) => o.country === "United States")
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: "US ZIP code must be in format: 12345 or 12345-6789",
  })
  // Canada: A1A 1A1
  @ValidateIf((o) => o.country === "Canada")
  @Matches(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, {
    message: "Canadian postal code must be in format: A1A 1A1",
  })
  // UK: AA11 1AA
  @ValidateIf((o) => o.country === "United Kingdom")
  @Matches(/^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/, {
    message: "UK postal code must be in format: AA11 1AA",
  })
  // Australia: 1234
  @ValidateIf((o) => o.country === "Australia")
  @Matches(/^\d{4}$/, {
    message: "Australian postal code must be 4 digits",
  })
  // Generic for other countries
  @ValidateIf(
    (o) =>
      !["United States", "Canada", "United Kingdom", "Australia"].includes(
        o.country
      )
  )
  @Matches(/^[A-Z0-9\s-]{3,10}$/, {
    message: "Postal code must be 3-10 characters",
  })
  postalCode: string;

  @IsString()
  @IsNotEmpty({ message: "Country is required" })
  @IsIn(VALID_COUNTRIES, {
    message: `Country must be one of: ${VALID_COUNTRIES.join(", ")}`,
  })
  country: string;
}
