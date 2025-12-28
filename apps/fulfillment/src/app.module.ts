import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FulfillmentService } from "./modules/fulfillment/fulfillment.service";
import { ConsumerInboxEntity } from "./modules/fulfillment/infrastructure/entities/consumer-inbox.entity";
import { FulfillmentTaskEntity } from "./modules/fulfillment/infrastructure/entities/fulfillment-task.entity";
import { OrderEventsConsumer } from "./modules/fulfillment/order-events.consumer";
import { HealthController } from "./modules/health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("FULFILLMENT_DATABASE_HOST", "localhost"),
        port: configService.get("FULFILLMENT_DATABASE_PORT", 5433),
        username: configService.get("FULFILLMENT_DATABASE_USER", "postgres"),
        password: configService.get(
          "FULFILLMENT_DATABASE_PASSWORD",
          "postgres"
        ),
        database: configService.get(
          "FULFILLMENT_DATABASE_NAME",
          "pdq_fulfillment"
        ),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: true,
        logging: configService.get("NODE_ENV") === "development",
      }),
    }),
    TypeOrmModule.forFeature([ConsumerInboxEntity, FulfillmentTaskEntity]),
  ],
  controllers: [HealthController],
  providers: [FulfillmentService, OrderEventsConsumer],
})
export class AppModule {}
