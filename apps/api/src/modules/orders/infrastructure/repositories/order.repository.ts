import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../entities/order.entity';

@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repository: Repository<OrderEntity>,
  ) {}

  async findById(id: string): Promise<OrderEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['items', 'shippingAddress'],
    });
  }

  async save(order: OrderEntity): Promise<OrderEntity> {
    return this.repository.save(order);
  }
}
