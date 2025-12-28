import { Logger } from "@nestjs/common";

/**
 * Base class for all use cases in the application.
 *
 * Provides:
 * - Standardized error handling
 * - Logging
 * - Template method pattern for execute
 * - Clear separation between orchestration (use case) and implementation (service)
 *
 * Usage:
 * ```typescript
 * export class MyUseCase extends UseCase<InputDto, OutputDto> {
 *   constructor(private readonly myService: MyService) {
 *     super(MyUseCase.name);
 *   }
 *
 *   protected async executeImpl(input: InputDto): Promise<OutputDto> {
 *     // Orchestrate the business logic by calling services
 *     const result = await this.myService.doSomething(input);
 *     return result;
 *   }
 * }
 * ```
 */
export abstract class UseCase<TInput, TOutput> {
  protected readonly logger: Logger;

  constructor(protected readonly useCaseName: string) {
    this.logger = new Logger(useCaseName);
  }

  /**
   * Public execution method with error handling wrapper.
   * This method should be called by controllers/handlers.
   */
  async execute(
    input: TInput,
    context?: Record<string, any>
  ): Promise<TOutput> {
    const correlationId = context?.correlationId || "N/A";

    try {
      this.logger.log(
        `Executing ${this.useCaseName} (correlation: ${correlationId})`
      );

      const result = await this.executeImpl(input, context);

      this.logger.log(
        `Successfully executed ${this.useCaseName} (correlation: ${correlationId})`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to execute ${this.useCaseName} (correlation: ${correlationId}): ${error.message}`,
        error.stack
      );

      // Re-throw the error so it can be handled by exception filters
      throw error;
    }
  }

  /**
   * Abstract method to be implemented by concrete use cases.
   * This is where the business logic orchestration happens.
   *
   * @param input - The input data for the use case
   * @param context - Optional context (correlationId, userId, etc.)
   */
  protected abstract executeImpl(
    input: TInput,
    context?: Record<string, any>
  ): Promise<TOutput>;
}
