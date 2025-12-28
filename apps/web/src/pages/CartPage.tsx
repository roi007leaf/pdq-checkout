import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cartApi } from '../api/checkout';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { formatCurrency } from '../utils/format';

export function CartPage() {
  const navigate = useNavigate();

  const { data: cart, isLoading, error } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
  });

  if (isLoading) {
    return (
      <div>
        <CheckoutSteps current="cart" />
        <div className="card">
          <p>Loading cart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <CheckoutSteps current="cart" />
        <div className="alert alert-error">
          Failed to load cart. Please try again.
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div>
        <CheckoutSteps current="cart" />
        <div className="card">
          <p>Your cart is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CheckoutSteps current="cart" />

      <div className="card">
        <h2 className="card-title">Your Cart</h2>

        {cart.items.map((item) => (
          <div key={item.sku} className="cart-item">
            <div className="cart-item-info">
              <div className="cart-item-name">{item.name}</div>
              <div className="cart-item-details">
                SKU: {item.sku} • Qty: {item.quantity} × {formatCurrency(item.unitPrice, cart.currency)}
              </div>
            </div>
            <div className="cart-item-price">
              {formatCurrency(item.lineTotal, cart.currency)}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="card-title">Order Summary</h2>

        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(cart.subtotal, cart.currency)}</span>
        </div>

        <div className="summary-row">
          <span>Tax</span>
          <span>{formatCurrency(cart.tax, cart.currency)}</span>
        </div>

        <div className="summary-row summary-total">
          <span>Total</span>
          <span>{formatCurrency(cart.grandTotal, cart.currency)}</span>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        onClick={() => navigate('/shipping')}
      >
        Continue to Shipping
      </button>
    </div>
  );
}
