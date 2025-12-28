# PDQ Checkout

A complete e-commerce checkout flow implementation with NestJS backend and React frontend.

## Features

- **Cart Display**: View cart contents with product details, quantities, and prices
- **Shipping Form**: Validated address collection with inline error feedback
- **Payment Processing**: Mock payment gateway with simulated success/failure scenarios
- **Order status page**: Shows processing state, confirmed orders, and payment failures (with reason + retry)
- **Idempotency**: Prevents duplicate orders on payment retries
- **Microservices Architecture**: 3 services (API Gateway, Orders, Payment) with DB-per-service
- **Event-Driven**: Kafka/Redpanda for inter-service communication
- **Transactional Outbox**: Reliable event publishing
- **Consumer Inbox Pattern**: Idempotent message processing
- **Graceful failures**: Database connectivity issues map to HTTP 503 with `Retry-After`

## Microservices Architecture

This implementation uses a **true microservices architecture** with:

- **API Gateway** (`apps/api`): HTTP endpoints, idempotency, Kafka producer
- **Orders Service** (`apps/orders`): Order lifecycle management with its own database
- **Payment Service** (`apps/payment`): Payment processing with its own database

Each service:

- Has its own PostgreSQL database (DB-per-service pattern)
- Communicates via Kafka events, not shared tables
- Uses inbox/outbox patterns for reliable, exactly-once processing
- Can be scaled independently

## Tech Stack

### Backend

- **NestJS** - Node.js framework with TypeScript
- **TypeORM** - Database ORM with PostgreSQL
- **KafkaJS** - Kafka client for event publishing
- **Clean Architecture** - Use-case based organization

### Frontend

- **React 18** - UI library
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Vite** - Build tool and dev server

### Infrastructure

- **PostgreSQL 16** - Primary database
- **Redpanda** - Kafka-compatible event streaming
- **Docker Compose** - Local development environment

## Project Structure

```text
PDQ/
├── apps/
│   ├── api/                    # NestJS API Gateway
│   │   └── src/
│   │       ├── common/         # Shared utilities, filters, middleware
│   │       └── modules/
│   │           ├── cart/       # Cart service (mock data)
│   │           ├── checkout/   # Shipping & payment endpoints
│   │           ├── orders/     # Order proxy to Orders service
│   │           ├── idempotency/# Idempotency key management
│   │           ├── messaging/  # Kafka producer
│   │           └── health/     # Health check endpoint
│   │
│   ├── orders/                 # Orders microservice
│   │   └── src/modules/orders/ # Order lifecycle, inbox, outbox
│   │
│   ├── payment/                # Payment microservice
│   │   └── src/modules/payment/# Payment processing, inbox, outbox
│   │
│   └── web/                    # React frontend
│       └── src/
│           ├── api/            # API client & types
│           ├── components/     # Shared UI components
│           ├── context/        # React context (checkout state)
│           ├── pages/          # Page components
│           └── utils/          # Helper functions
│
└── infra/
    └── compose/                # Docker Compose configuration
```

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

## Setup

### 1. Clone and install dependencies

```bash
# Install root dependencies
npm install

# Install all app dependencies
npm run install:all
```

### 2. Start infrastructure

```bash
# Start PostgreSQL and Redpanda
npm run docker:up

# View logs (optional)
npm run docker:logs
```

Services will be available at:

- PostgreSQL (API): `localhost:5432`
- PostgreSQL (Orders): `localhost:5435`
- PostgreSQL (Payment): `localhost:5434`
- Redpanda (Kafka): `localhost:19092`
- Redpanda Console: `http://localhost:8080`

Databases:

- API DB: `localhost:5432` (db: `pdq_checkout`)
- Orders DB: `localhost:5435` (db: `pdq_orders`)
- Payment DB: `localhost:5434` (db: `pdq_payment`)

### 3. Create environment file

```bash
# Copy example env file
cp .env.example .env
```

### 4. Start development servers

```bash
# Start API Gateway and web UI
npm run dev
```

Or run all microservices:

```bash
npm run dev:all
```

Or start individually:

```bash
# Terminal 1: API Gateway (port 3000)
npm run dev:api

# Terminal 2: Orders Service (port 3003)
npm run dev:orders

# Terminal 3: Payment Service (port 3002)
npm run dev:payment

# Terminal 4: Web UI (port 5173)
npm run dev:web
```

### 5. Access the application

- Frontend: <http://localhost:5173>
- API Gateway: <http://localhost:3000/api>
- Orders Service: <http://localhost:3003/health>
- Payment Service: <http://localhost:3002/health>
- Redpanda Console: <http://localhost:8080>

## API Endpoints

| Method | Endpoint                 | Description                                              |
| ------ | ------------------------ | -------------------------------------------------------- |
| GET    | `/api/health`            | Health check                                             |
| GET    | `/api/cart`              | Get cart contents                                        |
| POST   | `/api/checkout/shipping` | Validate shipping address                                |
| POST   | `/api/checkout/payment`  | Start checkout async (requires `Idempotency-Key` header) |
| GET    | `/api/orders/:id`        | Get order details                                        |

## Checkout flow (what actually happens)

The endpoint name `/api/checkout/payment` can be misleading: it **does not synchronously charge the card**.
It **starts an async checkout** by publishing a Kafka event, then returns immediately with `PENDING_PAYMENT`.

High-level sequence:

1. **Client validates shipping**
   - `POST /api/checkout/shipping`
2. **Client starts checkout**
   - `POST /api/checkout/payment`
   - API generates an `orderId`, publishes `CheckoutRequested` to topic `checkout.requests`, returns:
     - `status: PENDING_PAYMENT`
     - `orderId`
3. **Orders service creates the order**
   - Consumes `checkout.requests`
   - Persists order (in the **Orders DB**, `pdq_orders`) with status `PENDING_PAYMENT`
   - Publishes `PaymentRequested` to topic `payment.requests`
4. **Payment service processes payment**
   - Consumes `payment.requests`
   - Executes mock gateway rules (based on last 4 digits)
   - Persists a row in **Payment DB** (`pdq_payment.payment_transactions`)
   - Publishes `PaymentCompleted` or `PaymentFailed` to topic `payment.events`
5. **Orders service updates order status**
   - Consumes `payment.events`
   - Updates order to `CONFIRMED` or `PAYMENT_FAILED`

To observe completion in the UI, the client polls:

- `GET /api/orders/:id` (API gateway proxies/queries the Orders service)

### UI behavior (async confirmation)

Because payment is async, the UI **cannot** treat a successful `POST /api/checkout/payment` as “order confirmed”.
Instead the web app navigates to `/confirmation/:orderId` and:

- Polls `GET /api/orders/:id` until the order reaches a terminal state.
- Shows one of these states:
  - `PENDING_PAYMENT` / `PROCESSING` → **Processing Payment…**
  - `CONFIRMED` → **Order Confirmed** (and only then the checkout state is cleared)
  - `PAYMENT_FAILED` → **Payment Failed** + error message + “Try Another Card”

Note: right after kickoff, the order may not exist yet in the Orders service; a brief **404** can be normal while the async flow catches up.

Code pointers (current implementation):

- API kickoff: `apps/api/src/modules/checkout/checkout.controller.ts` and `apps/api/src/modules/checkout/application/use-cases/async-checkout.usecase.ts`
- Orders consumers + order creation: `apps/orders/src/modules/orders/**`
- Payment consumer + persistence: `apps/payment/src/modules/payment/payment.service.ts`

### Error responses

Errors are returned as `application/problem+json` with a stable `code` and a `traceId`.

- Dependency outages (e.g., Postgres unavailable) return **503** with `code=DEPENDENCY_UNAVAILABLE` and a `Retry-After` header.

## Testing Payment

The mock payment gateway simulates different scenarios based on card number:

| Card Number Ending | Result                           |
| ------------------ | -------------------------------- |
| Any other          | ✅ Success                       |
| `0000`             | ❌ Declined (insufficient funds) |
| `1111`             | ❌ Declined (invalid card)       |
| `9999`             | ❌ Gateway error                 |

Example test card: `4242424242424242`

When a payment fails, the Orders service stores error details and the UI displays them.

## Architecture Decisions

### Use-Case Architecture (Clean Architecture)

The backend follows a use-case based organization within each module:

```text
module/
├── application/
│   ├── use-cases/     # Business logic orchestration
│   └── dtos/          # Input/output data structures
├── infrastructure/
│   ├── entities/      # TypeORM entities
│   ├── repositories/  # Data access layer
│   └── gateways/      # External service adapters
└── module.ts          # NestJS module definition
```

**Why**: Clear separation of concerns, testable business logic, infrastructure can be swapped without changing use-cases.

### Idempotency

Payment endpoint requires an `Idempotency-Key` header to prevent duplicate orders:

1. Client generates a unique key (UUID) and includes it in the request
2. Server hashes the request payload and stores it with the key
3. On retry with same key:
   - Same payload → Returns cached response
   - Different payload → Returns 409 Conflict
4. Keys expire after 24 hours

**Why**: Protects against network retries, double-clicks, and client bugs that could create duplicate orders.

### Transactional Outbox

Events are published reliably using the transactional outbox pattern:

1. Order creation and outbox event are written in the same database transaction
2. Background publisher polls the outbox table on an interval (see `POLL_INTERVAL_MS` in each service)
3. Events are published to Redpanda with at-least-once delivery
4. Failed events are retried with exponential backoff

**Why**: Guarantees that if an order is created, the event will eventually be published. No "dual write" problem.

### Kafka Consumption: Inbox Pattern

Each microservice (Orders, Payment) uses the inbox pattern for safe consumption:

- Topic subscriptions: Orders (`checkout.requests`, `payment.events`), Payment (`payment.requests`)
- Dedupe: `consumer_inbox` table with unique constraint on `(consumerGroup, topic, partition, offset)`
- Transaction boundary: inbox record + business logic in same DB transaction

**Why**: In Kafka's at-least-once delivery, consumers will see duplicates. The inbox pattern makes processing idempotent and failure-safe.

### React Query for Server State

All API calls use React Query for:

- Automatic caching and deduplication
- Loading and error states
- Optimistic updates (where applicable)

**Why**: Simplifies data fetching, provides consistent UX patterns, reduces boilerplate.

### Form Validation

Validation happens at two levels:

1. **Client-side**: Immediate feedback before submission
2. **Server-side**: Authoritative validation with class-validator

Errors are mapped to field-level messages and displayed inline.

**Why**: Better UX with immediate feedback, security with server-side validation.

## Trade-offs & Assumptions

1. **Hardcoded Cart**: Cart contents are mocked. In production, this would be a separate service or database table.

2. **Synchronous TypeORM**: Using `synchronize: true` for development. In production, use migrations.

3. **In-Process Outbox Publisher**: The publisher runs in the API process. For high-volume, consider a separate worker.

4. **No Authentication**: Out of scope per requirements. Would add JWT validation middleware.

5. **Single Currency**: Assumes USD. Multi-currency would need exchange rate handling.

## Production Considerations

If deploying to production:

1. **Disable TypeORM synchronize**: Use migrations instead
2. **Add rate limiting**: Prevent abuse on payment endpoint
3. **Add monitoring**: Prometheus metrics, structured logging
4. **Separate outbox worker**: Scale independently from API
5. **Add retries**: Exponential backoff for external calls
6. **Health checks**: Add dependency checks (DB, Kafka)
7. **Secrets management**: Use proper secrets manager, not env files

## Troubleshooting

### Docker services won't start

```bash
# Reset and restart
npm run docker:down
docker volume prune
npm run docker:up
```

### Database connection errors

Ensure PostgreSQL is running and accessible:

```bash
docker exec -it pdq-postgres psql -U postgres -d pdq_checkout
```

### Kafka/Redpanda connection issues

The API will start without Kafka - events will remain in PENDING state in the outbox table until Kafka is available.

## License

MIT
