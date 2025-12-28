import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import {
  OutboxEventEntity,
  OutboxStatus,
} from './infrastructure/entities/outbox-event.entity';

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private producer: Producer | null = null;
  private isConnected = false;

  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly outboxRepository: Repository<OutboxEventEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.connectToKafka();
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }

  private async connectToKafka() {
    const brokers = this.configService.get('KAFKA_BROKERS', 'localhost:19092');

    try {
      const kafka = new Kafka({
        clientId: 'pdq-api',
        brokers: brokers.split(','),
        logLevel: logLevel.WARN,
        retry: {
          initialRetryTime: 1000,
          retries: 5,
        },
      });

      this.producer = kafka.producer();
      await this.producer.connect();
      this.isConnected = true;
      console.log('✅ Connected to Redpanda/Kafka');
    } catch (error) {
      console.warn('⚠️ Could not connect to Redpanda/Kafka:', error instanceof Error ? error.message : error);
      console.warn('⚠️ Outbox publishing disabled - events will remain in PENDING state');
    }
  }

  @Interval(POLL_INTERVAL_MS)
  async publishPendingEvents() {
    if (!this.isConnected || !this.producer) {
      return;
    }

    const pendingEvents = await this.outboxRepository.find({
      where: {
        status: OutboxStatus.PENDING,
        availableAt: LessThanOrEqual(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: BATCH_SIZE,
    });

    for (const event of pendingEvents) {
      await this.publishEvent(event);
    }
  }

  private async publishEvent(event: OutboxEventEntity): Promise<void> {
    if (!this.producer) return;

    const topic = `${event.aggregateType}.events`;
    const message = {
      key: event.aggregateId,
      value: JSON.stringify({
        specVersion: '1.0',
        eventId: event.id,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        occurredAt: event.createdAt.toISOString(),
        producer: { service: 'pdq-api', env: process.env.NODE_ENV || 'development' },
        correlationId: event.headers?.correlationId || null,
        data: event.payload,
      }),
      headers: {
        eventType: event.eventType,
        eventVersion: String(event.eventVersion),
      },
    };

    try {
      await this.producer.send({
        topic,
        messages: [message],
      });

      await this.outboxRepository.update(event.id, {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      console.log(`📤 Published event ${event.eventType} to ${topic}`);
    } catch (error) {
      const attempts = event.attempts + 1;
      const status = attempts >= MAX_RETRIES ? OutboxStatus.FAILED : OutboxStatus.PENDING;
      const availableAt = new Date();
      availableAt.setSeconds(availableAt.getSeconds() + Math.pow(2, attempts) * 5);

      await this.outboxRepository.update(event.id, {
        status,
        attempts,
        availableAt,
        lastError: error instanceof Error ? error.message : String(error),
      });

      console.error(`❌ Failed to publish event ${event.id}:`, error);
    }
  }
}
