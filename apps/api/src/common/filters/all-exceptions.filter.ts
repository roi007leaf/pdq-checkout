import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { QueryFailedError, TypeORMError } from "typeorm";
import { getCorrelationId } from "../middleware/correlation-id.middleware";

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  traceId: string;
  errors?: Array<{ field: string; message: string }>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = getCorrelationId(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let title = "Internal Server Error";
    let detail: string | undefined;
    let errors: Array<{ field: string; message: string }> | undefined;
    let retryAfterSeconds: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        code = (resp.code as string) || this.getCodeFromStatus(status);
        title =
          (resp.title as string) || (resp.error as string) || exception.message;
        detail = resp.detail as string | undefined;

        // Prefer structured field errors if provided
        if (
          Array.isArray(resp.errors) &&
          resp.errors.every(
            (e) =>
              typeof e === "object" &&
              e !== null &&
              "field" in (e as any) &&
              "message" in (e as any)
          )
        ) {
          errors = (resp.errors as Array<any>).map((e) => ({
            field: String(e.field),
            message: String(e.message),
          }));
          title = (resp.title as string) || "Validation Error";
          code = (resp.code as string) || "VALIDATION_ERROR";
        }

        // Handle validation errors from class-validator
        if (!errors && Array.isArray(resp.message)) {
          errors = resp.message.map((msg: string) => {
            const match = msg.match(/^(\w+)\s+(.+)$/);
            if (match) {
              return { field: match[1], message: match[2] };
            }
            return { field: "unknown", message: msg };
          });
          title = "Validation Error";
          code = "VALIDATION_ERROR";
        }
      } else {
        title = exceptionResponse as string;
        code = this.getCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      // Map dependency failures (e.g., Postgres down) to 503 so clients can react appropriately.
      if (this.isDependencyUnavailableError(exception)) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        code = "DEPENDENCY_UNAVAILABLE";
        title = "Service temporarily unavailable";
        detail =
          "A required dependency (database) is unavailable. Please try again shortly.";
        retryAfterSeconds = 5;

        // Keep logs lightweight; don’t dump full stack for expected outages.
        console.warn("Dependency unavailable:", exception.message);
      } else {
        detail = exception.message;
        console.error("Unhandled exception:", exception);
      }
    }

    const problemDetails: ProblemDetails = {
      type: `https://api.pdq.com/problems/${code
        .toLowerCase()
        .replace(/_/g, "-")}`,
      title,
      status,
      detail,
      instance: request.url,
      code,
      traceId: correlationId,
      ...(errors && { errors }),
    };

    const res = response
      .status(status)
      .header("Content-Type", "application/problem+json");

    if (retryAfterSeconds !== undefined) {
      res.header("Retry-After", String(retryAfterSeconds));
    }

    res.json(problemDetails);
  }

  private isDependencyUnavailableError(exception: Error): boolean {
    // TypeORM/PG connection failures commonly surface as TypeORMError or QueryFailedError
    // with underlying driver codes/messages.
    if (
      exception instanceof TypeORMError ||
      exception instanceof QueryFailedError
    ) {
      const msg = exception.message.toLowerCase();
      return (
        msg.includes("econnrefused") ||
        msg.includes("connection terminated") ||
        msg.includes("terminating connection") ||
        msg.includes("timeout") ||
        msg.includes("could not connect") ||
        msg.includes("the database system is starting up") ||
        msg.includes("remaining connection slots")
      );
    }

    // Some driver/network errors bubble up as plain Error with a code.
    const anyErr = exception as unknown as { code?: string };
    if (anyErr.code) {
      return ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"].includes(
        anyErr.code
      );
    }

    const msg = exception.message.toLowerCase();
    return (
      msg.includes("econnrefused") ||
      (msg.includes("connect") && msg.includes("refused")) ||
      (msg.includes("database") && msg.includes("unavailable")) ||
      msg.includes("could not connect")
    );
  }

  private getCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHENTICATED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      case 422:
        return "UNPROCESSABLE_ENTITY";
      case 429:
        return "RATE_LIMITED";
      case 503:
        return "DEPENDENCY_UNAVAILABLE";
      default:
        return "INTERNAL_ERROR";
    }
  }
}
