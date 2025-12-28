import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./modules/health/health.controller";
import { PaymentModule } from "./modules/payment/payment.module";

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
        host: configService.get("PAYMENT_DATABASE_HOST", "localhost"),
        port: configService.get("PAYMENT_DATABASE_PORT", 5434),
        username: configService.get("PAYMENT_DATABASE_USER", "postgres"),
        password: configService.get("PAYMENT_DATABASE_PASSWORD", "postgres"),
        database: configService.get("PAYMENT_DATABASE_NAME", "pdq_payment"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: true, // For dev only
        logging: false,
      }),
    }),
    PaymentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
