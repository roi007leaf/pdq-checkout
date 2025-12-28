# PDQ Microservices Architecture

## Overview

PDQ implements a true microservices architecture with dedicated databases per service, event-driven communication via Kafka, and idempotent message processing.

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │     │  Redpanda UI    │     │  PostgreSQL x3  │
│   (React)       │     │  :8080          │     │  (per service)  │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   API Gateway   │◄─────────────────────────────────────┐
│   :3000         │                                      │
│   (apps/api)    │                                      │
└────────┬────────┘                                      │
         │ Kafka: checkout.requests                      │
         ▼                                               │
┌─────────────────┐     Kafka: payment.requests    ┌─────┴───────────┐
│  Orders Service │────────────────────────────────►│ Payment Service │
│  :3003          │                                │  :3002          │
│  (apps/orders)  │◄───────────────────────────────│  (apps/payment) │
└─────────────────┘     Kafka: payment.events      └─────────────────┘
```

## Services

| Service         | Port | Database            | Responsibilities                        |
| --------------- | ---- | ------------------- | --------------------------------------- |
| **API Gateway** | 3000 | pdq_checkout (5432) | HTTP API, idempotency, Kafka producer   |
| **Orders**      | 3003 | pdq_orders (5435)   | Order lifecycle, saga orchestration     |
| **Payment**     | 3002 | pdq_payment (5434)  | Payment processing, transaction records |

## Kafka Topics

| Topic               | Publisher   | Consumers                          | Event Types                                            |
| ------------------- | ----------- | ---------------------------------- | ------------------------------------------------------ |
| `checkout.requests` | API Gateway | Orders                             | `CheckoutRequested`                                    |
| `payment.requests`  | Orders      | Payment                            | `PaymentRequested`                                     |
| `payment.events`    | Payment     | Orders                             | `PaymentCompleted`, `PaymentFailed`                    |
| `order.events`      | Orders      | _(future: shipping/notifications)_ | `OrderCreated`, `OrderConfirmed`, `OrderPaymentFailed` |

## Event Flow

### Happy Path (Successful Checkout)

```
1. Client → POST /api/checkout/payment
2. API Gateway → Kafka: CheckoutRequested
3. API Gateway → Client: { orderId, status: "PENDING_PAYMENT" }
4. Orders Service ← Kafka: CheckoutRequested
5. Orders Service → Create order (status: PENDING_PAYMENT)
6. Orders Service → Kafka: PaymentRequested
7. Payment Service ← Kafka: PaymentRequested
8. Payment Service → Process payment (mock gateway)
9. Payment Service → Kafka: PaymentCompleted
10. Orders Service ← Kafka: PaymentCompleted
11. Orders Service → Update order (status: CONFIRMED)
12. Orders Service → Kafka: OrderConfirmed
13. Client → GET /api/orders/:id → Order details
```

### Payment Failure Path

```
7. Payment Service ← Kafka: PaymentRequested
8. Payment Service → Process payment (fails)
9. Payment Service → Kafka: PaymentFailed
10. Orders Service ← Kafka: PaymentFailed
11. Orders Service → Update order (status: PAYMENT_FAILED)
12. Orders Service → Kafka: OrderPaymentFailed
```

## Idempotency Patterns

### 1. API Gateway - Idempotency Key Header

```typescript
// Client sends: Idempotency-Key: <uuid>
// Gateway checks/creates idempotency record before processing
await idempotencyService.checkOrCreate(key, scope, payload);
```

- Uses `idempotency_keys` table with unique constraint on `(key, scope)`
- Returns cached response if already completed
- Rejects concurrent duplicate requests with 409 Conflict

### 2. Kafka Consumers - Inbox Pattern

```typescript
// Each consumer stores processed messages
@Entity("consumer_inbox")
@Index(
  "uniq_consumer_inbox",
  ["consumerGroup", "topic", "partition", "offset"],
  { unique: true }
)
export class ConsumerInboxEntity {
  consumerGroup: string;
  topic: string;
  partition: number;
  offset: string; // bigint
}
```

- Insert inbox record in same transaction as business logic
- Duplicate key = message already processed → skip
- Provides exactly-once processing semantics

### 3. Outbox Pattern - Reliable Publishing

```typescript
// In transaction with business logic:
await manager.save(order);
await outboxService.createEvent(
  manager,
  "Order",
  order.id,
  "OrderCreated",
  payload
);

// Outbox publisher polls and publishes:
setInterval(() => publishPendingEvents(), 1000);
```

- Events written to `outbox_events` table in same transaction
- Background process polls and publishes to Kafka
- Retries with exponential backoff on failures
- Marks events as PUBLISHED or FAILED

## Database Schema (per service)

### Orders Service

```sql
-- Core entities
orders (id, status, currency, subtotal, tax, grandTotal, paymentId, ...)
order_items (id, orderId, productId, name, quantity, unitPrice, totalPrice)
shipping_addresses (id, orderId, fullName, addressLine1, city, ...)

-- Infrastructure
consumer_inbox (id, consumerGroup, topic, partition, offset)
outbox_events (id, aggregateType, aggregateId, eventType, payload, status, ...)
```

### Payment Service

```sql
-- Core entities
payment_transactions (id, orderId, status, amount, currency, transactionId, ...)

-- Infrastructure
consumer_inbox (id, consumerGroup, topic, partition, offset)
outbox_events (id, aggregateType, aggregateId, eventType, payload, status, ...)
```

## Configuration

### Environment Variables

```bash
# Service ports
API_PORT=3000
ORDERS_PORT=3003
PAYMENT_PORT=3002

# Kafka
KAFKA_BROKERS=localhost:19092

# Each service has its own database
ORDERS_DATABASE_PORT=5435
PAYMENT_DATABASE_PORT=5434
```

### Running All Services

```bash
# Start infrastructure (3 Postgres instances + Redpanda)
npm run docker:up

# Start all services
npm run dev:all

# Or individually
npm run dev:api        # API Gateway
npm run dev:orders     # Orders service
npm run dev:payment    # Payment service
npm run dev:web        # Frontend
```

## Scaling Considerations

### Horizontal Scaling

- Each service can be scaled independently
- Kafka consumer groups handle partition distribution
- Database connection pooling per service instance

### Event Ordering

- Use `orderId` as Kafka message key for ordering guarantees
- Same order always goes to same partition
- Consumer processes messages in order within partition

### Failure Handling

- Outbox retry with exponential backoff
- Dead letter queue for poison messages (TODO)
- Circuit breaker for external services (TODO)

## Monitoring (TODO)

- Prometheus metrics per service
- Distributed tracing with correlation IDs
- Redpanda Console for Kafka monitoring
- Service health endpoints: `/health`
