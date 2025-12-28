import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  IdempotencyKeyEntity,
  IdempotencyStatus,
} from './infrastructure/entities/idempotency-key.entity';
import { IdempotencyConflictException } from '../../common/exceptions/domain.exceptions';

export interface IdempotencyCheckResult {
  status: IdempotencyStatus;
  isNew: boolean;
  response?: Record<string, unknown>;
}

const IDEMPOTENCY_TTL_HOURS = 24;

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKeyEntity)
    private readonly idempotencyRepository: Repository<IdempotencyKeyEntity>,
  ) {}

  async checkOrCreate(
    key: string,
    scope: string,
    payload: unknown,
  ): Promise<IdempotencyCheckResult> {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    // Try to find existing key
    const existing = await this.idempotencyRepository.findOne({
      where: { key, scope },
    });

    if (existing) {
      // Key exists - check if same payload
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyConflictException();
      }

      // Same key and payload
      if (existing.status === IdempotencyStatus.COMPLETED) {
        return {
          status: IdempotencyStatus.COMPLETED,
          isNew: false,
          response: existing.responseBody || undefined,
        };
      }

      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        return {
          status: IdempotencyStatus.IN_PROGRESS,
          isNew: false,
        };
      }

      // Status is FAILED - allow retry
      existing.status = IdempotencyStatus.IN_PROGRESS;
      existing.lockedAt = new Date();
      await this.idempotencyRepository.save(existing);

      return {
        status: IdempotencyStatus.IN_PROGRESS,
        isNew: true,
      };
    }

    // Create new idempotency record
    try {
      const newRecord = this.idempotencyRepository.create({
        key,
        scope,
        requestHash,
        status: IdempotencyStatus.IN_PROGRESS,
        lockedAt: new Date(),
        expiresAt,
      });

      await this.idempotencyRepository.save(newRecord);

      return {
        status: IdempotencyStatus.IN_PROGRESS,
        isNew: true,
      };
    } catch (error: unknown) {
      // Handle race condition - another request created the record
      if (
        error instanceof Error &&
        error.message.includes('duplicate key')
      ) {
        return this.checkOrCreate(key, scope, payload);
      }
      throw error;
    }
  }

  async markCompleted(
    key: string,
    scope: string,
    responseCode: number,
    responseBody: Record<string, unknown>,
  ): Promise<void> {
    await this.idempotencyRepository.update(
      { key, scope },
      {
        status: IdempotencyStatus.COMPLETED,
        responseCode,
        responseBody,
        lockedAt: null,
      },
    );
  }

  async markFailed(key: string, scope: string): Promise<void> {
    await this.idempotencyRepository.update(
      { key, scope },
      {
        status: IdempotencyStatus.FAILED,
        lockedAt: null,
      },
    );
  }

  private hashPayload(payload: unknown): string {
    const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}
