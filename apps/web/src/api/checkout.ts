import { get, post, generateIdempotencyKey } from './client';

// Types
export interface CartItem {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Cart {
  items: CartItem[];
  currency: string;
  subtotal: number;
  tax: number;
  grandTotal: number;
}

export interface ShippingAddress {
  fullName: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface ValidatedShipping {
  valid: boolean;
  shippingAddress: ShippingAddress;
  estimatedDelivery: string;
}

export interface PaymentDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

export interface ProcessPaymentRequest {
  shippingAddress: ShippingAddress;
  paymentDetails: PaymentDetails;
}

export interface PaymentResponse {
  orderId: string;
  status: string;
  grandTotal: number;
  currency: string;
  createdAt: string;
  replayed?: boolean;
}

export interface Order {
  orderId: string;
  status: string;
  currency: string;
  items: CartItem[];
  totals: {
    subtotal: number;
    tax: number;
    grandTotal: number;
  };
  shippingAddress: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

// API functions
export const cartApi = {
  getCart: () => get<Cart>('/cart'),
};

export const checkoutApi = {
  validateShipping: (address: ShippingAddress) =>
    post<ValidatedShipping>('/checkout/shipping', address),

  processPayment: (request: ProcessPaymentRequest, idempotencyKey?: string) =>
    post<PaymentResponse>('/checkout/payment', request, {
      idempotencyKey: idempotencyKey || generateIdempotencyKey(),
    }),
};

export const ordersApi = {
  getOrder: (orderId: string) => get<Order>(`/orders/${orderId}`),
};
