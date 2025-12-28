import { Injectable } from "@nestjs/common";

export interface CartItem {
  sku: string;
  name: string;
  unitPrice: number; // cents
  quantity: number;
  lineTotal: number; // cents
}

export interface Cart {
  items: CartItem[];
  currency: string;
  subtotal: number;
  tax: number;
  grandTotal: number;
}

// Mock cart data - in production this would come from a cart service/database
const MOCK_CART_ITEMS: CartItem[] = [
  {
    sku: "WIDGET-001",
    name: "Premium Widget",
    unitPrice: 2999, // $29.99
    quantity: 2,
    lineTotal: 5998,
  },
  {
    sku: "GADGET-002",
    name: "Super Gadget",
    unitPrice: 4999, // $49.99
    quantity: 1,
    lineTotal: 4999,
  },
  {
    sku: "CABLE-003",
    name: "USB-C Cable",
    unitPrice: 999, // $9.99
    quantity: 3,
    lineTotal: 2997,
  },
];

@Injectable()
export class CartService {
  getCart(): Cart {
    const items = MOCK_CART_ITEMS;
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const tax = 0; // Tax calculation is out of scope
    const grandTotal = subtotal + tax;

    return {
      items,
      currency: "USD",
      subtotal,
      tax,
      grandTotal,
    };
  }

  getCartItems(): CartItem[] {
    return MOCK_CART_ITEMS;
  }
}
