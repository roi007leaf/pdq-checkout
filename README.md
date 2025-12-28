# PDQ Checkout

A complete e-commerce checkout flow implementation with NestJS backend and React frontend.

## Features

- **Cart Display**: View cart contents with product details, quantities, and prices
- **Shipping Form**: Validated address collection with inline error feedback
- **Payment Processing**: Mock payment gateway with simulated success/failure scenarios
- **Order Confirmation**: Unique order ID with full order details
- **Idempotency**: Prevents duplicate orders on payment retries
- **Transactional Outbox**: Reliable event publishing to Kafka/Redpanda
- **Kafka Consumer (Inbox pattern)**: Demonstrates safe, idempotent consumption of `OrderCreated`
- **Graceful dependency failures**: Database connectivity issues map to HTTP 503 with `Retry-After`

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

```
PDQ/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── common/         # Shared utilities, filters, middleware
│   │       └── modules/
│   │           ├── cart/       # Cart service (mock data)
│   │           ├── checkout/   # Shipping & payment use-cases
│   │           ├── orders/     # Order persistence & retrieval
│   │           ├── idempotency/# Idempotency key management
│   │           ├── outbox/     # Transactional outbox publisher
│   │           └── health/     # Health check endpoint
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

- PostgreSQL: `localhost:5432`
- Redpanda (Kafka): `localhost:19092`
- Redpanda Console: `http://localhost:8080`

### 3. Create environment file

```bash
# Copy example env file
cp .env.example .env
```

### 4. Start development servers

```bash
# Start both API and web servers
npm run dev
```

Or start individually:

```bash
# Terminal 1: Start API (port 3000)
npm run dev:api

# Terminal 2: Start Web (port 5173)
npm run dev:web
```

### 5. Access the application

- Frontend: <http://localhost:5173>
- API: <http://localhost:3000/api>
- Health check: <http://localhost:3000/api/health>

## API Endpoints

| Method | Endpoint                 | Description                                         |
| ------ | ------------------------ | --------------------------------------------------- |
| GET    | `/api/health`            | Health check                                        |
| GET    | `/api/cart`              | Get cart contents                                   |
| POST   | `/api/checkout/shipping` | Validate shipping address                           |
| POST   | `/api/checkout/payment`  | Process payment (requires `Idempotency-Key` header) |
| GET    | `/api/orders/:id`        | Get order details                                   |

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

## Architecture Decisions

### Use-Case Architecture (Clean Architecture)

The backend follows a use-case based organization within each module:

```
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
2. Background publisher polls the outbox table every 5 seconds
3. Events are published to Redpanda with at-least-once delivery
4. Failed events are retried with exponential backoff

**Why**: Guarantees that if an order is created, the event will eventually be published. No "dual write" problem.

### Kafka Consumption: Inbox / Dedupe

To demonstrate safe consumption (at-least-once delivery), the API also runs a small consumer that listens to `OrderCreated` events.

- Topic: `order.events`
- Dedupe: `consumer_inbox` table with a unique constraint on `(consumerGroup, topic, partition, offset)`
- Side-effect example: `fulfillment_tasks` table (unique per `orderId`)

**Why**: In production, consumers will see duplicates. The inbox pattern makes processing idempotent and failure-safe.

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
