import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  const port = process.env.FULFILLMENT_PORT || 3001;
  await app.listen(port);
  console.log(`🚚 Fulfillment service running on http://localhost:${port}/api`);
}

bootstrap();
