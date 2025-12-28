import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (validationErrors) => {
        const flatten = (
          errs: any[],
          parentPath = ""
        ): Array<{ field: string; message: string }> => {
          const out: Array<{ field: string; message: string }> = [];

          for (const err of errs) {
            const field = parentPath
              ? `${parentPath}.${err.property}`
              : err.property;
            if (err.constraints) {
              for (const msg of Object.values(err.constraints)) {
                out.push({ field, message: String(msg) });
              }
            }
            if (Array.isArray(err.children) && err.children.length > 0) {
              out.push(...flatten(err.children, field));
            }
          }
          return out;
        };

        const errors = flatten(validationErrors as any[]);
        return new BadRequestException({
          code: "VALIDATION_ERROR",
          title: "Validation Error",
          detail: "One or more fields are invalid",
          errors,
        });
      },
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  });

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();
