import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/checkout';
import { CheckoutSteps } from '../components/CheckoutSteps';
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
      <div>
        <CheckoutSteps current="confirmation" />
        <div className="card">
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <CheckoutSteps current="confirmation" />
        <div className="alert alert-error">
          Failed to load order details. Please contact support with your order ID.
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/cart')}>
          Return to Cart
        </button>
      </div>
    );
  }

  return (
    <div>
      <CheckoutSteps current="confirmation" />

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="confirmation-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-success)' }}>
          Order Confirmed!
        </h2>
        <p style={{ color: 'var(--color-gray-500)', marginBottom: '1rem' }}>
          Thank you for your purchase
        </p>

        <div className="order-id">
          Order ID: <strong>{order.orderId}</strong>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Order Details</h2>

        {order.items.map((item) => (
          <div key={item.sku} className="cart-item">
            <div className="cart-item-info">
              <div className="cart-item-name">{item.name}</div>
              <div className="cart-item-details">
                Qty: {item.quantity} × {formatCurrency(item.unitPrice, order.currency)}
              </div>
            </div>
            <div className="cart-item-price">
              {formatCurrency(item.lineTotal, order.currency)}
            </div>
          </div>
        ))}

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-gray-200)' }}>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatCurrency(order.totals.subtotal, order.currency)}</span>
          </div>
          <div className="summary-row">
            <span>Tax</span>
            <span>{formatCurrency(order.totals.tax, order.currency)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatCurrency(order.totals.grandTotal, order.currency)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Shipping Address</h2>
        <p style={{ margin: 0 }}>
          <strong>{order.shippingAddress.fullName}</strong>
          <br />
          {order.shippingAddress.streetAddress}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.stateProvince}{' '}
          {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link to="/cart" className="btn btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
