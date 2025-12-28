import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../api/checkout';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCurrency } from '../utils/format';

export function ConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.getOrder(orderId!),
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
        <CheckoutSteps current="confirmation" />
        <Card>
          <CardContent className="pt-6">
            <p>Loading order details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
        <CheckoutSteps current="confirmation" />
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load order details. Please contact support with your order ID.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/cart')}>
          Return to Cart
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
      <CheckoutSteps current="confirmation" />

      <Card className="text-center">
        <CardContent className="pt-10 pb-8">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-xl animate-in zoom-in duration-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="white"
              className="w-12 h-12"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>

          <h2 className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
            Order Confirmed!
          </h2>
          <p className="text-muted-foreground mb-6 text-lg">
            Thank you for your purchase. We'll send you a confirmation email shortly.
          </p>

          <div className="inline-block bg-muted px-6 py-3 rounded-lg">
            Order ID: <strong className="text-primary">{order.orderId}</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items.map((item) => (
            <div key={item.sku} className="flex justify-between items-start border-b pb-4 last:border-0 last:pb-0">
              <div>
                <div className="font-semibold mb-1">{item.name}</div>
                <div className="text-sm text-muted-foreground">
                  Qty: {item.quantity} × {formatCurrency(item.unitPrice, order.currency)}
                </div>
              </div>
              <div className="font-semibold text-primary">
                {formatCurrency(item.lineTotal, order.currency)}
              </div>
            </div>
          ))}

          <div className="pt-4 space-y-2 border-t-2">
            <div className="flex justify-between text-base">
              <span>Subtotal</span>
              <span>{formatCurrency(order.totals.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span>Tax</span>
              <span>{formatCurrency(order.totals.tax, order.currency)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold pt-2">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(order.totals.grandTotal, order.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Address</CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed">
          <strong className="text-base">{order.shippingAddress.fullName}</strong>
          <br />
          {order.shippingAddress.streetAddress}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.stateProvince}{' '}
          {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </CardContent>
      </Card>

      <div className="text-center pt-4">
        <Link to="/cart">
          <Button size="lg">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}
