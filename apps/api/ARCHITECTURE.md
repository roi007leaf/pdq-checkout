# Use Case Architecture

## Overview

This application follows a **clean architecture** pattern with a clear separation between:

- **Use Cases** (orchestration layer)
- **Services** (implementation layer)
- **Infrastructure** (external dependencies)

## Base Use Case Pattern

All use cases extend from `UseCase<TInput, TOutput>` which provides:

### Features

- ✅ **Standardized error handling** - Catches and logs all errors
- ✅ **Structured logging** - Logs execution start/end with correlation IDs
- ✅ **Template method pattern** - `execute()` wraps `executeImpl()`
- ✅ **Context propagation** - Pass correlation IDs and other metadata
- ✅ **Plug-and-play services** - Services can be swapped without changing use case logic

### Example

```typescript
@Injectable()
export class ProcessPaymentUseCase extends UseCase<
  ProcessPaymentDto,
  PaymentResponse
> {
  constructor(
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    @Inject('PaymentGateway') private readonly paymentGateway: PaymentGateway
  ) {
    super(ProcessPaymentUseCase.name);
  }

  protected async executeImpl(
    dto: ProcessPaymentDto,
    context?: { correlationId: string }
  ): Promise<PaymentResponse> {
    // Step 1: Process payment through payment gateway service
    const paymentResult = await this.paymentGateway.processPayment({...});

    // Step 2: Create order through order service
    const order = await this.orderService.createOrderWithOutbox({...});

    return {...};
  }
}
```

## Service Layer

Services contain the actual business logic implementation and can be swapped out:

### ShippingService

- `validateAddress()` - Validate shipping addresses (can integrate with USPS, Google Maps, etc.)
- `estimateDelivery()` - Calculate delivery dates (can integrate with FedEx, UPS, etc.)
- `calculateShippingCost()` - Determine shipping costs

### OrderService

- `createOrderWithOutbox()` - Create orders with transactional outbox pattern
- `getOrderById()` - Retrieve order details
- `updateOrderStatus()` - Update order status

### PaymentGateway (Interface)

- `processPayment()` - Process payments
- Implementations: `MockPaymentGateway`, `StripeGateway`, `PayPalGateway`, etc.

## Benefits

### 1. Plug-and-Play Services

Replace service implementations without touching use case code:

```typescript
// Module configuration
providers: [
  {
    provide: "PaymentGateway",
    useClass: StripeGateway, // Switch from MockPaymentGateway to StripeGateway
  },
];
```

### 2. Testability

Mock services easily in tests:

```typescript
const mockOrderService = {
  createOrderWithOutbox: jest.fn().mockResolvedValue(mockOrder),
};

const useCase = new ProcessPaymentUseCase(
  cartService,
  mockOrderService,
  mockPaymentGateway
);
```

### 3. Clear Separation of Concerns

- **Use Cases** = Business workflow orchestration
- **Services** = Implementation details
- **Infrastructure** = External integrations

### 4. Consistent Error Handling

All use cases automatically log errors with correlation IDs:

```
[ProcessPaymentUseCase] Executing ProcessPaymentUseCase (correlation: abc-123)
[ProcessPaymentUseCase] Successfully executed ProcessPaymentUseCase (correlation: abc-123)
```

### 5. Easy to Extend

Add new services without modifying existing code:

```typescript
@Injectable()
export class EmailService {
  async sendOrderConfirmation(order: Order): Promise<void> {
    // Implementation
  }
}

// Use in any use case
protected async executeImpl(dto: Input): Promise<Output> {
  const order = await this.orderService.createOrder(dto);
  await this.emailService.sendOrderConfirmation(order);
  return order;
}
```

## Calling Use Cases

### From Controllers

```typescript
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly processPaymentUseCase: ProcessPaymentUseCase) {}

  @Post("payment")
  async processPayment(@Body() dto: ProcessPaymentDto, @Req() req: Request) {
    const correlationId = getCorrelationId(req);

    return this.processPaymentUseCase.execute(dto, { correlationId });
  }
}
```

### From Event Handlers

```typescript
@Consumer()
export class OrderEventsConsumer {
  constructor(private readonly createOrderUseCase: CreateOrderUseCase) {}

  @EventPattern("OrderRequested")
  async handleOrderRequested(event: OrderRequestedEvent) {
    await this.createOrderUseCase.execute(event.data, {
      correlationId: event.correlationId,
    });
  }
}
```

## Migration Guide

### Converting Existing Use Cases

1. **Extend UseCase base class**

   ```typescript
   export class MyUseCase extends UseCase<InputDto, OutputDto>
   ```

2. **Update constructor to call super**

   ```typescript
   constructor(private readonly myService: MyService) {
     super(MyUseCase.name);
   }
   ```

3. **Rename `execute()` to `executeImpl()`**

   ```typescript
   protected async executeImpl(input: InputDto): Promise<OutputDto>
   ```

4. **Add context parameter**

   ```typescript
   protected async executeImpl(
     input: InputDto,
     context?: { correlationId: string }
   ): Promise<OutputDto>
   ```

5. **Extract business logic to services**

   ```typescript
   // Before
   protected async executeImpl(dto: Input): Promise<Output> {
     const order = await this.dataSource.transaction(async (manager) => {
       // Complex DB operations...
     });
     return order;
   }

   // After
   protected async executeImpl(dto: Input): Promise<Output> {
     const order = await this.orderService.createOrder(dto);
     return order;
   }
   ```

## File Structure

```
src/
├── common/
│   └── application/
│       └── use-case.base.ts          # Base class for all use cases
├── modules/
│   └── checkout/
│       ├── application/
│       │   ├── services/             # Business logic services
│       │   │   ├── order.service.ts
│       │   │   └── shipping.service.ts
│       │   └── use-cases/            # Orchestration use cases
│       │       ├── process-payment.usecase.ts
│       │       └── validate-shipping.usecase.ts
│       └── infrastructure/
│           └── gateways/             # External integrations
│               ├── payment-gateway.interface.ts
│               └── mock-payment.gateway.ts
```

## Best Practices

1. **Keep use cases thin** - They should only orchestrate, not implement
2. **Services do the work** - All business logic belongs in services
3. **One responsibility per service** - ShippingService handles shipping, OrderService handles orders
4. **Use interfaces for external dependencies** - PaymentGateway, EmailProvider, etc.
5. **Pass context through** - Always pass correlationId and other metadata
6. **Log in services too** - Use NestJS Logger for consistency
7. **Test services independently** - Unit test services without use cases
8. **Integration test use cases** - Test the orchestration with real/mock services
