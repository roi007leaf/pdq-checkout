import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./modules/health/health.controller";
import { OrdersModule } from "./modules/orders/orders.module";

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
        host: configService.get("ORDERS_DATABASE_HOST", "localhost"),
        port: configService.get("ORDERS_DATABASE_PORT", 5435),
        username: configService.get("ORDERS_DATABASE_USER", "postgres"),
        password: configService.get("ORDERS_DATABASE_PASSWORD", "postgres"),
        database: configService.get("ORDERS_DATABASE_NAME", "pdq_orders"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: true, // For dev only
        logging: false,
      }),
    }),
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
