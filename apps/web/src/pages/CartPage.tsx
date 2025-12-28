import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cartApi } from '../api/checkout';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCurrency } from '../utils/format';

export function CartPage() {
  const navigate = useNavigate();

  const { data: cart, isLoading, error } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <CheckoutSteps current="cart" />
        <Card>
          <CardContent className="pt-6">
            <p>Loading cart...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <CheckoutSteps current="cart" />
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load cart. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <CheckoutSteps current="cart" />
        <Card>
          <CardContent className="pt-6">
            <p>Your cart is empty.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
      <CheckoutSteps current="cart" />

      <Card>
        <CardHeader>
          <CardTitle>Your Cart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.items.map((item) => (
            <div 
              key={item.sku} 
              className="flex justify-between items-center p-4 border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex-1">
                <div className="font-semibold text-lg">{item.name}</div>
                <div className="text-sm text-muted-foreground">
                  SKU: {item.sku} • Qty: {item.quantity} × {formatCurrency(item.unitPrice, cart.currency)}
                </div>
              </div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(item.lineTotal, cart.currency)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-base">
            <span>Subtotal</span>
            <span className="font-semibold">{formatCurrency(cart.subtotal, cart.currency)}</span>
          </div>

          <div className="flex justify-between text-base">
            <span>Tax</span>
            <span className="font-semibold">{formatCurrency(cart.tax, cart.currency)}</span>
          </div>

          <div className="flex justify-between text-xl font-bold pt-3 border-t-2">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(cart.grandTotal, cart.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={() => navigate('/shipping')}
      >
        Continue to Shipping
      </Button>
    </div>
  );
}
