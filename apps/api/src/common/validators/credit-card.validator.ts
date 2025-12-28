import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * Luhn algorithm (Mod 10) validator for credit card numbers.
 * Used by all major card networks (Visa, Mastercard, Amex, etc.)
 */
@ValidatorConstraint({ name: "isCreditCard", async: false })
export class IsCreditCardConstraint implements ValidatorConstraintInterface {
  validate(cardNumber: string): boolean {
    if (!cardNumber || typeof cardNumber !== "string") {
      return false;
    }

    // Remove spaces and dashes
    const cleaned = cardNumber.replace(/[\s-]/g, "");

    // Must be digits only
    if (!/^\d+$/.test(cleaned)) {
      return false;
    }

    // Must be 15-16 digits (Amex is 15, most others are 16)
    if (cleaned.length < 15 || cleaned.length > 16) {
      return false;
    }

    // Skip Luhn validation in development/test mode
    if (process.env.SKIP_LUHN_VALIDATION === "true") {
      return true;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    // Loop through values starting from the rightmost digit
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  defaultMessage(): string {
    return "Invalid credit card number";
  }
}

export function IsCreditCard(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCreditCardConstraint,
    });
  };
}
