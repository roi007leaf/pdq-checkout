import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { checkoutApi, cartApi, PaymentDetails } from '../api/checkout';
import { useCheckout } from '../context/CheckoutContext';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { ApiException, generateIdempotencyKey } from '../api/client';
import { formatCurrency } from '../utils/format';

interface FormErrors {
  [key: string]: string;
}

export function PaymentPage() {
  const navigate = useNavigate();
  const { shippingAddress, clearCheckout } = useCheckout();

  // Generate idempotency key once on mount and persist across retries
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const { data: cart } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
  });

  const [formData, setFormData] = useState<PaymentDetails>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const mutation = useMutation({
    mutationFn: () => {
      if (!shippingAddress) {
        throw new Error('Shipping address is required');
      }
      return checkoutApi.processPayment(
        {
          shippingAddress,
          paymentDetails: formData,
        },
        idempotencyKeyRef.current,
      );
    },
    onSuccess: (data) => {
      clearCheckout();
      navigate(`/confirmation/${data.orderId}`);
    },
    onError: (error) => {
      if (error instanceof ApiException && error.error.errors) {
        const newErrors: FormErrors = {};
        error.error.errors.forEach((e) => {
          // Extract field name from nested path like "paymentDetails.cardNumber"
          const fieldName = e.field.split('.').pop() || e.field;
          newErrors[fieldName] = e.message;
        });
        setErrors(newErrors);
      }
      // Generate new idempotency key for retry after failure
      idempotencyKeyRef.current = generateIdempotencyKey();
    },
  });

  // Redirect if no shipping address
  if (!shippingAddress) {
    navigate('/shipping');
    return null;
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.cardNumber.trim()) {
      newErrors.cardNumber = 'Card number is required';
    } else if (!/^\d{13,19}$/.test(formData.cardNumber.replace(/\s/g, ''))) {
      newErrors.cardNumber = 'Invalid card number';
    }

    if (!formData.expiryDate.trim()) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (!/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
      newErrors.expiryDate = 'Use MM/YY format';
    }

    if (!formData.cvv.trim()) {
      newErrors.cvv = 'CVV is required';
    } else if (!/^\d{3,4}$/.test(formData.cvv)) {
      newErrors.cvv = 'Invalid CVV';
    }

    if (!formData.cardholderName.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      mutation.mutate();
    }
  };

  const handleChange = (field: keyof PaymentDetails) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div>
      <CheckoutSteps current="payment" />

      <form onSubmit={handleSubmit}>
        {/* Order Summary */}
        {cart && (
          <div className="card">
            <h2 className="card-title">Order Summary</h2>
            <div className="summary-row summary-total">
              <span>Total to Pay</span>
              <span>{formatCurrency(cart.grandTotal, cart.currency)}</span>
            </div>
          </div>
        )}

        {/* Shipping Address Summary */}
        <div className="card">
          <h2 className="card-title">Shipping To</h2>
          <p style={{ margin: 0 }}>
            <strong>{shippingAddress.fullName}</strong>
            <br />
            {shippingAddress.streetAddress}
            <br />
            {shippingAddress.city}, {shippingAddress.stateProvince}{' '}
            {shippingAddress.postalCode}
            <br />
            {shippingAddress.country}
          </p>
        </div>

        {/* Payment Form */}
        <div className="card">
          <h2 className="card-title">Payment Details</h2>

          <div className="form-group">
            <label className="form-label" htmlFor="cardNumber">
              Card Number
            </label>
            <input
              id="cardNumber"
              type="text"
              className={`form-input ${errors.cardNumber ? 'error' : ''}`}
              value={formData.cardNumber}
              onChange={handleChange('cardNumber')}
              placeholder="4242424242424242"
              maxLength={19}
            />
            {errors.cardNumber && (
              <div className="form-error">{errors.cardNumber}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cardholderName">
              Cardholder Name
            </label>
            <input
              id="cardholderName"
              type="text"
              className={`form-input ${errors.cardholderName ? 'error' : ''}`}
              value={formData.cardholderName}
              onChange={handleChange('cardholderName')}
              placeholder="John Doe"
            />
            {errors.cardholderName && (
              <div className="form-error">{errors.cardholderName}</div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="expiryDate">
                Expiry Date
              </label>
              <input
                id="expiryDate"
                type="text"
                className={`form-input ${errors.expiryDate ? 'error' : ''}`}
                value={formData.expiryDate}
                onChange={handleChange('expiryDate')}
                placeholder="MM/YY"
                maxLength={5}
              />
              {errors.expiryDate && (
                <div className="form-error">{errors.expiryDate}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cvv">
                CVV
              </label>
              <input
                id="cvv"
                type="text"
                className={`form-input ${errors.cvv ? 'error' : ''}`}
                value={formData.cvv}
                onChange={handleChange('cvv')}
                placeholder="123"
                maxLength={4}
              />
              {errors.cvv && <div className="form-error">{errors.cvv}</div>}
            </div>
          </div>
        </div>

        {/* Test Card Info */}
        <div className="card" style={{ background: '#fef3c7', border: '1px solid #f59e0b' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            <strong>Test Cards:</strong><br />
            ✅ Any card number = Success<br />
            ❌ Ending in 0000 = Declined (insufficient funds)<br />
            ❌ Ending in 1111 = Declined (invalid card)<br />
            ❌ Ending in 9999 = Gateway error
          </p>
        </div>

        {mutation.error && !(mutation.error instanceof ApiException && mutation.error.error.errors) && (
          <div className="alert alert-error">
            {mutation.error instanceof ApiException
              ? mutation.error.error.detail || mutation.error.error.title
              : 'An error occurred. Please try again.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/shipping')}
          >
            Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <span className="spinner" />
                Processing Payment...
              </>
            ) : (
              `Pay ${cart ? formatCurrency(cart.grandTotal, cart.currency) : ''}`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
