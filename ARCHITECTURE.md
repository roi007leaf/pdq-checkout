# PDQ Checkout System - Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Microservices Architecture](#microservices-architecture)
3. [Database Architecture](#database-architecture)
4. [Event-Driven Flow](#event-driven-flow)
5. [Payment Processing](#payment-processing)
6. [Payment Validation](#payment-validation)
7. [Test Cards](#test-cards)
8. [Running the System](#running-the-system)

---

## System Overview

PDQ is an e-commerce checkout system built with a **microservices architecture** using:

- **Backend**: NestJS (TypeScript)
- **Frontend**: React + TanStack Query
- **Message Broker**: Kafka/Redpanda
- **Database**: PostgreSQL (3 separate databases)
- **Patterns**: Event-driven, Transactional Outbox, Consumer Inbox (idempotency)

### Key Features

- ✅ Asynchronous payment processing
- ✅ Event-driven architecture with Kafka
- ✅ Idempotency for all operations
- ✅ Transactional outbox pattern
- ✅ Comprehensive payment validation
- ✅ Real-time order status updates

---

## Microservices Architecture

### Services

#### 1. **API Service** (Port 3000)

- **Purpose**: Gateway for frontend, handles HTTP requests
- **Database**: `pdq_checkout` (Port 5432)
- **Responsibilities**:
  - Validate shipping addresses
  - Publish checkout events to Kafka
  - Query order status from Orders service
  - Manage idempotency keys

**Key Files**:

- [apps/api/src/modules/checkout/checkout.controller.ts](apps/api/src/modules/checkout/checkout.controller.ts)
- [apps/api/src/modules/checkout/application/use-cases/async-checkout.usecase.ts](apps/api/src/modules/checkout/application/use-cases/async-checkout.usecase.ts)

#### 2. **Orders Service** (Port 3003)

- **Purpose**: Manages order lifecycle
- **Database**: `pdq_orders` (Port 5435)
- **Responsibilities**:
  - Create orders from checkout events
  - Request payments via Kafka
  - Update order status based on payment results
  - Publish order events (created, confirmed, failed)

**Key Files**:

- [apps/orders/src/modules/orders/orders.service.ts](apps/orders/src/modules/orders/orders.service.ts)
- [apps/orders/src/modules/orders/checkout-consumer.ts](apps/orders/src/modules/orders/checkout-consumer.ts)
- [apps/orders/src/modules/orders/payment-events-consumer.ts](apps/orders/src/modules/orders/payment-events-consumer.ts)

#### 3. **Payment Service** (Port 3002)

- **Purpose**: Processes payments
- **Database**: `pdq_payment` (Port 5434)
- **Responsibilities**:
  - Process payment requests from Kafka
  - Call mock payment gateway
  - Store payment transactions
  - Publish payment results

**Key Files**:

- [apps/payment/src/modules/payment/payment.service.ts](apps/payment/src/modules/payment/payment.service.ts)
- [apps/payment/src/modules/payment/payment-consumer.ts](apps/payment/src/modules/payment/payment-consumer.ts)

#### 4. **Web Frontend** (Port 5173)

- **Purpose**: User interface
- **Key Features**:
  - Shopping cart
  - Multi-step checkout flow
  - Real-time order status polling
  - Auto-formatting for card numbers

**Key Files**:

- [apps/web/src/pages/PaymentPage.tsx](apps/web/src/pages/PaymentPage.tsx)
- [apps/web/src/api/checkout.ts](apps/web/src/api/checkout.ts)

---

## Database Architecture

### Three Separate Databases

```
┌─────────────────────┐
│   pdq_checkout      │  Port 5432
│   (API Service)     │
├─────────────────────┤
│ - idempotency_keys  │
│ - outbox_events     │
└─────────────────────┘

┌─────────────────────┐
│   pdq_orders        │  Port 5435
│   (Orders Service)  │
├─────────────────────┤
│ - orders            │  ← Real orders here!
│ - order_items       │
│ - shipping_address  │
│ - consumer_inbox    │
│ - outbox_events     │
└─────────────────────┘

┌─────────────────────┐
│   pdq_payment       │  Port 5434
│   (Payment Service) │
├─────────────────────┤
│ - payment_transactions │ ← Payment data here!
│ - consumer_inbox    │
│ - outbox_events     │
└─────────────────────┘
```

### Why Separate Databases?

**Microservices Principle**: Each service owns its own data

- **Loose Coupling**: Services can evolve independently
- **Scalability**: Scale databases independently
- **Resilience**: Failure in one DB doesn't affect others
- **Data Isolation**: Clear boundaries of responsibility

### Connection Configuration

**Orders Service** - [apps/orders/src/app.module.ts](apps/orders/src/app.module.ts):

```typescript
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    type: "postgres",
    host: configService.get("ORDERS_DATABASE_HOST", "localhost"),
    port: configService.get("ORDERS_DATABASE_PORT", 5435),
    database: configService.get("ORDERS_DATABASE_NAME", "pdq_orders"),
    // ...
  }),
});
```

**Payment Service** - [apps/payment/src/app.module.ts](apps/payment/src/app.module.ts):

```typescript
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    type: "postgres",
    host: configService.get("PAYMENT_DATABASE_HOST", "localhost"),
    port: configService.get("PAYMENT_DATABASE_PORT", 5434),
    database: configService.get("PAYMENT_DATABASE_NAME", "pdq_payment"),
    // ...
  }),
});
```

---

## Event-Driven Flow

> Note on naming: the endpoint `POST /api/checkout/payment` **does not synchronously charge the card**.
> It **starts the async checkout** by publishing `CheckoutRequested` to Kafka and immediately returns `{ orderId, status: "PENDING_PAYMENT" }`.
> The actual payment attempt happens later in the **Payment service** after the Orders service emits `PaymentRequested`.

### Complete Checkout Flow

```
┌─────────┐       ┌─────────┐       ┌─────────┐       ┌─────────┐
│  User   │       │   API   │       │ Orders  │       │ Payment │
└────┬────┘       └────┬────┘       └────┬────┘       └────┬────┘
     │                 │                 │                 │
     │ POST /checkout/payment            │                 │
     │────────────────>│                 │                 │
     │                 │                 │                 │
     │ 201 PENDING_PAYMENT               │                 │
     │<────────────────│                 │                 │
     │                 │                 │                 │
     │                 │ ① CheckoutRequested              │
     │                 │────────────────>│                 │
     │                 │                 │                 │
     │                 │                 │ ② PaymentRequested
     │                 │                 │────────────────>│
     │                 │                 │                 │
     │                 │                 │                 │ ③ Process Payment
     │                 │                 │                 │    (Call Gateway)
     │                 │                 │                 │
     │                 │                 │ ④ PaymentCompleted/Failed
     │                 │                 │<────────────────│
     │                 │                 │                 │
     │                 │                 │ ⑤ Update Order  │
     │                 │                 │   Status        │
     │                 │                 │                 │
     │ GET /orders/:id │                 │                 │
     │────────────────>│                 │                 │
     │                 │ Query Orders Service              │
     │                 │────────────────>│                 │
     │                 │ Order Details   │                 │
     │                 │<────────────────│                 │
     │ Order Status    │                 │                 │
     │<────────────────│                 │                 │
```

### Kafka Topics

```
checkout.requests   → Orders creates order
payment.requests    → Payment processes payment
payment.events      → Orders updates status
order.events        → Other services (fulfillment, etc.)
```

### Step-by-Step with Code

#### Step 1: Client Starts Checkout ("payment" step)

**Frontend** - [apps/web/src/pages/PaymentPage.tsx](apps/web/src/pages/PaymentPage.tsx):

```typescript
const mutation = useMutation({
  mutationFn: async () => {
    const sanitizedPaymentDetails: PaymentDetails = {
      cardNumber: formData.cardNumber.replace(/\s/g, ""), // Strip spaces
      expiryDate: formData.expiryDate,
      cvv: formData.cvv,
      cardholderName: formData.cardholderName,
    };

    return processPayment({
      shippingAddress: shippingAddress!,
      paymentDetails: sanitizedPaymentDetails,
    });
  },
});
```

#### Step 2: API Publishes to Kafka

**API Service** - [apps/api/src/modules/checkout/application/use-cases/async-checkout.usecase.ts](apps/api/src/modules/checkout/application/use-cases/async-checkout.usecase.ts):

```typescript
protected async executeImpl(dto: ProcessPaymentDto) {
  const orderId = uuidv4();

  // Publish to Kafka
  await this.messagingService.publishCheckoutRequest({
    orderId,
    shippingAddress: dto.shippingAddress,
    paymentDetails: dto.paymentDetails,
    cartData: cart,
  });

  return {
    orderId,
    status: "PENDING_PAYMENT",
    message: "Your order has been received and is being processed.",
    grandTotal: cart.grandTotal,
    currency: cart.currency,
    createdAt: new Date(),
  };
}
```

#### Step 3: Orders Service Creates Order

**Orders Service** - [apps/orders/src/modules/orders/orders.service.ts](apps/orders/src/modules/orders/orders.service.ts):

```typescript
async createOrder(manager: EntityManager, input: CreateOrderInput) {
  // Create order with PENDING_PAYMENT status
  const order = manager.create(OrderEntity, {
    id: input.order.id,
    status: OrderStatus.PENDING_PAYMENT,
    currency: input.order.currency,
    subtotal: input.order.subtotal,
    tax: input.order.tax,
    grandTotal: input.order.grandTotal,
    // ...
  });

  await manager.save(order);

  // Publish PaymentRequested event
  const paymentRequestEvent = manager.create(OutboxEventEntity, {
    eventType: "PaymentRequested",
    payload: {
      orderId: order.id,
      paymentRequest: input.order.paymentRequest,
    },
  });

  await manager.save(paymentRequestEvent);
}
```

#### Step 4: Payment Service Processes Payment

**Payment Service** - [apps/payment/src/modules/payment/payment.service.ts](apps/payment/src/modules/payment/payment.service.ts):

```typescript
async processPayment(manager: EntityManager, input: ProcessPaymentInput) {
  // Call mock gateway
  const paymentResult = await this.executePayment(input.paymentRequest);

  // Store payment transaction
  const payment = manager.create(PaymentTransactionEntity, {
    orderId: input.orderId,
    status: paymentResult.success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
    amount: input.paymentRequest.amount,
    transactionId: paymentResult.transactionId,
    errorMessage: paymentResult.error,
    errorCode: paymentResult.errorCode,
  });

  await manager.save(payment);

  // Publish result
  const eventType = paymentResult.success ? "PaymentCompleted" : "PaymentFailed";
  const outboxEvent = manager.create(OutboxEventEntity, {
    eventType,
    payload: {
      paymentId: payment.id,
      orderId: input.orderId,
      status: payment.status,
    },
  });

  await manager.save(outboxEvent);
}
```

#### Step 5: Orders Service Updates Status

**Orders Service** - [apps/orders/src/modules/orders/orders.service.ts](apps/orders/src/modules/orders/orders.service.ts):

```typescript
async handlePaymentResult(manager: EntityManager, input: PaymentResultInput) {
  const order = await manager.findOne(OrderEntity, {
    where: { id: input.orderId },
  });

  if (input.status === "COMPLETED") {
    order.status = OrderStatus.CONFIRMED;
    order.paymentId = input.paymentId;
    order.paymentTransactionId = input.transactionId;
  } else {
    order.status = OrderStatus.PAYMENT_FAILED;
    order.metadata = {
      paymentError: input.error,
      paymentErrorCode: input.errorCode,
    };
  }

  await manager.save(order);
}
```

---

## Payment Processing

### Mock Payment Gateway Logic

**Payment Service** - [apps/payment/src/modules/payment/payment.service.ts](apps/payment/src/modules/payment/payment.service.ts):

```typescript
private async executePayment(request: PaymentRequest) {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const last4 = request.cardNumber.slice(-4);

  console.log(`[PaymentService] Processing payment: { last4: '${last4}', amount: ${request.amount} }`);

  if (last4 === "0000") {
    return {
      success: false,
      error: "Insufficient funds",
      errorCode: "INSUFFICIENT_FUNDS",
    };
  }

  if (last4 === "1111") {
    return {
      success: false,
      error: "Invalid card",
      errorCode: "INVALID_CARD",
    };
  }

  if (last4 === "9999") {
    return {
      success: false,
      error: "Payment gateway temporarily unavailable",
      errorCode: "GATEWAY_ERROR",
    };
  }

  // Success
  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };
}
```

### Transactional Outbox Pattern

**Why?** Ensures events are published reliably even if Kafka is temporarily down.

**How it works**:

1. Business logic + outbox event saved in **same transaction**
2. Outbox publisher polls for `PENDING` events
3. Publishes to Kafka and marks as `PUBLISHED`

**Outbox Publisher** - [apps/orders/src/modules/orders/outbox.publisher.ts](apps/orders/src/modules/orders/outbox.publisher.ts):

```typescript
private async publishPendingEvents() {
  const events = await this.outboxRepository.find({
    where: {
      status: OutboxStatus.PENDING,
      availableAt: LessThanOrEqual(new Date()),
    },
    take: 10,
    order: { createdAt: "ASC" },
  });

  for (const event of events) {
    await this.producer.send({
      topic: this.getTopicForEvent(event.eventType),
      messages: [{
        key: event.aggregateId,
        value: JSON.stringify(event.payload),
        headers: event.headers,
      }],
    });

    event.status = OutboxStatus.PUBLISHED;
    event.publishedAt = new Date();
    await this.outboxRepository.save(event);
  }
}
```

### Consumer Inbox Pattern (Idempotency)

**Why?** Ensures messages are processed exactly once, even if Kafka delivers duplicates.

**How it works**:

1. Consumer receives message with `(topic, partition, offset)`
2. Try to insert into `consumer_inbox` table (unique constraint)
3. If duplicate → skip processing
4. If new → process business logic

**Payment Consumer** - [apps/payment/src/modules/payment/payment-consumer.ts](apps/payment/src/modules/payment/payment-consumer.ts):

```typescript
await this.dataSource.transaction(async (manager) => {
  const result = await this.paymentService.processPayment(manager, {
    consumerGroup: "pdq-payment-dev",
    topic: message.topic,
    partition: message.partition,
    offset: message.offset,
    orderId: payload.orderId,
    paymentRequest: payload.paymentRequest,
  });

  if (!result.processed) {
    console.log(`⏭️  Message already processed (order: ${payload.orderId})`);
  }
});
```

---

## Payment Validation

### Backend Validation

**DTO Validation** - [apps/api/src/modules/checkout/application/dtos/process-payment.dto.ts](apps/api/src/modules/checkout/application/dtos/process-payment.dto.ts):

```typescript
export class PaymentDetailsDto {
  @IsString()
  @IsNotEmpty({ message: "Card number is required" })
  @Matches(/^[0-9]+$/, { message: "Card number must contain only digits" })
  @Length(15, 16, { message: "Card number must be 15-16 digits" })
  cardNumber: string;

  @IsString()
  @IsNotEmpty({ message: "Expiry date is required" })
  @Matches(/^(0[1-9]|1[0-2])\/[0-9]{2}$/, {
    message: "Expiry date must be in MM/YY format",
  })
  expiryDate: string;

  @IsString()
  @IsNotEmpty({ message: "CVV is required" })
  @Matches(/^[0-9]{3,4}$/, { message: "CVV must be 3-4 digits" })
  cvv: string;

  @IsString()
  @IsNotEmpty({ message: "Cardholder name is required" })
  cardholderName: string;
}
```

**Note**: Luhn algorithm validation was removed for mock payment testing.

### Frontend Validation & Auto-formatting

**Payment Page** - [apps/web/src/pages/PaymentPage.tsx](apps/web/src/pages/PaymentPage.tsx):

```typescript
const handleChange = (field: keyof FormData, value: string) => {
  let processedValue = value;

  // Auto-format card number with spaces
  if (field === "cardNumber") {
    const digitsOnly = value.replace(/\D/g, "");
    const formatted = digitsOnly.replace(/(\d{4})(?=\d)/g, "$1 ");
    processedValue = formatted.substring(0, 19); // 16 digits + 3 spaces
  }

  // Auto-format expiry date
  if (field === "expiryDate") {
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length >= 2) {
      processedValue =
        digitsOnly.substring(0, 2) + "/" + digitsOnly.substring(2, 4);
    } else {
      processedValue = digitsOnly;
    }
  }

  // CVV: digits only
  if (field === "cvv") {
    processedValue = value.replace(/\D/g, "").substring(0, 4);
  }

  setFormData((prev) => ({ ...prev, [field]: processedValue }));
};
```

**Data Sanitization** (strips spaces before API call):

```typescript
const sanitizedPaymentDetails: PaymentDetails = {
  cardNumber: formData.cardNumber.replace(/\s/g, ""), // Remove spaces
  expiryDate: formData.expiryDate,
  cvv: formData.cvv,
  cardholderName: formData.cardholderName,
};
```

---

## Test Cards

### Card Number Patterns

| Last 4 Digits | Result      | Error Message                             | Error Code           |
| ------------- | ----------- | ----------------------------------------- | -------------------- |
| `0000`        | ❌ Declined | "Insufficient funds"                      | `INSUFFICIENT_FUNDS` |
| `1111`        | ❌ Declined | "Invalid card"                            | `INVALID_CARD`       |
| `9999`        | ❌ Error    | "Payment gateway temporarily unavailable" | `GATEWAY_ERROR`      |
| **Any other** | ✅ Success  | -                                         | -                    |

### Test Card Numbers

```
✅ Success:
- 4242 4242 4242 4242
- 5555 5555 5555 4444
- 3782 822463 10005 (Amex - 15 digits)

❌ Insufficient Funds:
- 5555 5555 5555 0000

❌ Invalid Card:
- 5555 5555 5555 1111

❌ Gateway Error:
- 5555 5555 5555 9999
```

### Testing Failed Payments

1. **Submit payment** with card `5555555555551111`
2. **Watch logs** - Payment service should show:

   ```
   [PaymentService] Processing payment: { last4: '1111', amount: 13994 }
   ✅ Payment xxx processed for order xxx: PaymentFailed
   ```

3. **Check databases**:
   - `pdq_payment.payment_transactions` → status = `FAILED`, error_message = `Invalid card`
   - `pdq_orders.orders` → status = `PAYMENT_FAILED`

---

## Running the System

### Prerequisites

```bash
# Install dependencies
npm run install:all

# Start Kafka/Redpanda
docker-compose -f infra/compose/docker-compose.yml up -d
```

### Start All Services

```bash
# Start all 4 services (API, Orders, Payment, Web)
npm run dev:all
```

This starts:

- **API Service**: <http://localhost:3000>
- **Orders Service**: <http://localhost:3003>
- **Payment Service**: <http://localhost:3002>
- **Web Frontend**: <http://localhost:5173>

### Individual Services

```bash
# API only
npm run dev:api

# Orders only
npm run dev:orders

# Payment only
npm run dev:payment

# Frontend only
npm run dev:web
```

### Verify Services

```bash
# Check health endpoints
curl http://localhost:3000/api/health
curl http://localhost:3003/health
curl http://localhost:3002/health

# Check Kafka containers
docker ps --filter "name=redpanda"
```

### Expected Logs

**When all services start successfully**:

```
[0] ✅ API Gateway Kafka producer connected
[1] ✅ Orders consumer connected (topic: checkout.requests)
[1] ✅ Orders payment consumer connected (topic: payment.events)
[2] ✅ Payment consumer connected (topic: payment.requests)
```

**When processing a payment**:

```
[0] 📤 [API Gateway] Sent CheckoutRequested to checkout.requests
[1] ✅ Order xxx created with status PENDING_PAYMENT
[1] 📤 [Orders] Published: PaymentRequested to payment.requests
[2] [PaymentService] Processing payment: { last4: '1111', amount: 13994 }
[2] ✅ Payment xxx processed for order xxx: PaymentFailed
[2] 📤 [Payment] Published: PaymentFailed
[1] ✅ Order xxx updated to PAYMENT_FAILED
```

---

## Querying Data

### Connect to Databases

```bash
# API Database (Port 5432)
psql -h localhost -p 5432 -U postgres -d pdq_checkout

# Orders Database (Port 5435) - REAL ORDERS HERE
psql -h localhost -p 5435 -U postgres -d pdq_orders

# Payment Database (Port 5434)
psql -h localhost -p 5434 -U postgres -d pdq_payment
```

### Useful Queries

```sql
-- Orders Database (Port 5435)
SELECT id, status, grand_total, created_at
FROM orders
ORDER BY created_at DESC;

-- Payment Database (Port 5434)
SELECT id, order_id, status, amount, error_message, created_at
FROM payment_transactions
ORDER BY created_at DESC;

-- Check outbox events
SELECT event_type, status, created_at
FROM outbox_events
ORDER BY created_at DESC
LIMIT 10;
```

---

## Architecture Patterns Summary

### ✅ Implemented Patterns

1. **Microservices Architecture**

   - Independent services with separate databases
   - Communication via Kafka events

2. **Event-Driven Architecture**

   - Asynchronous processing
   - Loose coupling between services

3. **Transactional Outbox Pattern**

   - Reliable event publishing
   - Atomic business logic + event creation

4. **Consumer Inbox Pattern**

   - Exactly-once message processing
   - Idempotency for all operations

5. **CQRS (Command Query Responsibility Segregation)**

   - Write operations via Kafka events
   - Read operations via HTTP queries

6. **Saga Pattern** (implicit)
   - Distributed transaction across services
   - Compensating actions for failures

---

## Additional Resources

### Code Structure

```
apps/
├── api/          → API Gateway (Port 3000)
├── orders/       → Orders Service (Port 3003)
├── payment/      → Payment Service (Port 3002)
└── web/          → React Frontend (Port 5173)

infra/
└── compose/      → Docker Compose for Kafka/Postgres
```

### Key Technologies

- **NestJS**: Backend framework
- **TypeORM**: Database ORM
- **KafkaJS**: Kafka client
- **React**: Frontend framework
- **TanStack Query**: API state management
- **class-validator**: DTO validation
- **Redpanda**: Kafka-compatible message broker

---

## Troubleshooting

### Services won't start

```bash
# Check if ports are in use
netstat -ano | findstr :3000
netstat -ano | findstr :5173

# Kill processes if needed
taskkill /PID <pid> /F
```

### Kafka not working

```bash
# Check containers
docker ps

# Restart Kafka
docker-compose -f infra/compose/docker-compose.yml restart

# View logs
docker-compose -f infra/compose/docker-compose.yml logs -f
```

### Payments not processing

1. Check all 3 services are running (`npm run dev:all`)
2. Check Kafka is running (`docker ps`)
3. Watch logs for `[PaymentService] Processing payment`
4. Check `payment_transactions` table in **Port 5434** database

### Order not found

- Orders are in `pdq_orders` database (Port 5435), NOT `pdq_checkout` (Port 5432)
- Use Orders service API: `GET http://localhost:3003/orders/:id`

---

## Summary

This system demonstrates a **production-ready microservices architecture** with:

- ✅ Event-driven communication
- ✅ Database per service pattern
- ✅ Reliable event publishing (Outbox)
- ✅ Idempotent message processing (Inbox)
- ✅ Comprehensive validation
- ✅ Async payment processing
- ✅ Real-time status updates

Perfect for learning enterprise patterns and building scalable e-commerce systems!
