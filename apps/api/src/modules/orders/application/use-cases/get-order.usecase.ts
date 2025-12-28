import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UseCase } from "../../../../common/application/use-case.base";

export interface OrderOutput {
  orderId: string;
  status: string;
  currency: string;
  payment?: {
    id?: string | null;
    transactionId?: string | null;
    error?: string;
    errorCode?: string;
  };
  items: Array<{
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    grandTotal: number;
  };
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Gateway use case - proxies order lookups to the Orders microservice.
 * In async mode, orders live in the Orders service DB, not the API DB.
 */
@Injectable()
export class GetOrderUseCase extends UseCase<string, OrderOutput> {
  private readonly ordersServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    super(GetOrderUseCase.name);
    const host = this.configService.get("ORDERS_SERVICE_HOST", "localhost");
    const port = this.configService.get("ORDERS_SERVICE_PORT", "3003");
    this.ordersServiceUrl = `http://${host}:${port}`;
  }

  protected async executeImpl(orderId: string): Promise<OrderOutput> {
    try {
      const response = await fetch(
        `${this.ordersServiceUrl}/orders/${orderId}`
      );

      if (response.status === 404) {
        throw new NotFoundException(`Order with id '${orderId}' was not found`);
      }

      if (!response.ok) {
        throw new Error(
          `Orders service returned ${response.status}: ${response.statusText}`
        );
      }

      const orderData = await response.json();

      // Map Orders service schema to API gateway schema
      return {
        orderId: orderData.id,
        status: orderData.status,
        currency: orderData.currency,
        payment: orderData.payment
          ? {
              id: orderData.payment.id ?? orderData.paymentId ?? null,
              transactionId:
                orderData.payment.transactionId ??
                orderData.paymentTransactionId ??
                null,
              error: orderData.payment.error,
              errorCode: orderData.payment.errorCode,
            }
          : undefined,
        items:
          orderData.items?.map((item: any) => ({
            sku: item.productId || item.sku,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.totalPrice || item.lineTotal,
          })) || [],
        totals: {
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          grandTotal: orderData.grandTotal,
        },
        shippingAddress: orderData.shippingAddress
          ? {
              fullName: orderData.shippingAddress.fullName,
              streetAddress:
                orderData.shippingAddress.addressLine1 ||
                orderData.shippingAddress.streetAddress,
              city: orderData.shippingAddress.city,
              stateProvince:
                orderData.shippingAddress.state ||
                orderData.shippingAddress.stateProvince,
              postalCode: orderData.shippingAddress.postalCode,
              country: orderData.shippingAddress.country,
            }
          : ({} as any),
        createdAt: orderData.createdAt,
        updatedAt: orderData.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error("Error fetching order from Orders service:", error);
      throw new Error(
        "Unable to fetch order. The Orders service may be unavailable."
      );
    }
  }
}
