import { HttpException, HttpStatus } from "@nestjs/common";

export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    public readonly title: string,
    public readonly detail?: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super({ code, title, detail }, status);
  }
}

export class ValidationException extends DomainException {
  constructor(
    public readonly errors: Array<{ field: string; message: string }>,
    detail?: string
  ) {
    super(
      "VALIDATION_ERROR",
      "Validation Error",
      detail,
      HttpStatus.BAD_REQUEST
    );
  }
}

export class NotFoundException extends DomainException {
  constructor(resource: string, id: string) {
    super(
      "NOT_FOUND",
      `${resource} Not Found`,
      `${resource} with id '${id}' was not found`,
      HttpStatus.NOT_FOUND
    );
  }
}

export class ConflictException extends DomainException {
  constructor(code: string, title: string, detail?: string) {
    super(code, title, detail, HttpStatus.CONFLICT);
  }
}

export class IdempotencyConflictException extends ConflictException {
  constructor() {
    super(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency Key Conflict",
      "This idempotency key was already used with a different request payload"
    );
  }
}

export class PaymentFailedException extends DomainException {
  constructor(detail: string) {
    super(
      "PAYMENT_FAILED",
      "Payment Failed",
      detail,
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}
