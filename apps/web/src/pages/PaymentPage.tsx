import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cartApi, checkoutApi, PaymentDetails } from '../api/checkout';
import { generateIdempotencyKey } from '../api/client';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useCheckout } from '../context/CheckoutContext';
import { parseApiFieldErrors } from '../utils/apiErrors';
import { formatCurrency } from '../utils/format';

interface FormErrors {
  [key: string]: string;
}

export function PaymentPage() {
  const navigate = useNavigate();
  const { shippingAddress } = useCheckout();

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
  const [generalError, setGeneralError] = useState<string | null>(null);

  const paymentFieldMap: Record<string, string> = {
    cardnumber: 'cardNumber',
    number: 'cardNumber',
    expirydate: 'expiryDate',
    expirationdate: 'expiryDate',
    exp: 'expiryDate',
    cvv: 'cvv',
    cvc: 'cvv',
    cardholdername: 'cardholderName',
    name: 'cardholderName',
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!shippingAddress) {
        throw new Error('Shipping address is required');
      }
      
      // Sanitize payment details before sending to API
      const sanitizedPaymentDetails: PaymentDetails = {
        cardNumber: formData.cardNumber.replace(/\s/g, ''), // Remove spaces
        expiryDate: formData.expiryDate,
        cvv: formData.cvv,
        cardholderName: formData.cardholderName,
      };
      
      return checkoutApi.processPayment(
        {
          shippingAddress,
          paymentDetails: sanitizedPaymentDetails,
        },
        idempotencyKeyRef.current,
      );
    },
    onSuccess: (data) => {
      setGeneralError(null);
      navigate(`/confirmation/${data.orderId}`);
    },
    onError: (error) => {
      const parsed = parseApiFieldErrors(error, {
        fieldMap: paymentFieldMap,
        preferLastPathSegment: true,
        generalMessage: 'Please correct the highlighted payment fields and try again.',
      });
      setErrors(parsed.formErrors);
      setGeneralError(parsed.unmapped.length > 0 ? parsed.generalMessage || null : null);

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

    const cardNumberClean = formData.cardNumber.replace(/\s/g, '');
    if (!cardNumberClean.trim()) {
      newErrors.cardNumber = 'Card number is required';
    } else if (!/^\d+$/.test(cardNumberClean)) {
      newErrors.cardNumber = 'Card number must contain only digits';
    } else if (cardNumberClean.length < 15 || cardNumberClean.length > 16) {
      newErrors.cardNumber = 'Card number must be 15-16 digits';
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
      setGeneralError(null);
      mutation.mutate();
    }
  };

  const handleChange = (field: keyof PaymentDetails) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    let value = e.target.value;

    // Format card number with spaces every 4 digits
    if (field === 'cardNumber') {
      // Remove all non-digits
      value = value.replace(/\D/g, '');
      // Limit to 16 digits
      value = value.substring(0, 16);
      // Add space every 4 digits
      value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    }

    // Format expiry date with slash
    if (field === 'expiryDate') {
      value = value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
    }

    // Format CVV - digits only
    if (field === 'cvv') {
      value = value.replace(/\D/g, '').substring(0, 4);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
      <CheckoutSteps current="payment" />

      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Summary */}
        {cart && (
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-2xl font-bold">
                <span>Total to Pay</span>
                <span className="text-primary">{formatCurrency(cart.grandTotal, cart.currency)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipping Address Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping To</CardTitle>
          </CardHeader>
          <CardContent className="leading-relaxed">
            <strong className="text-base">{shippingAddress.fullName}</strong>
            <br />
            {shippingAddress.streetAddress}
            <br />
            {shippingAddress.city}, {shippingAddress.stateProvince}{' '}
            {shippingAddress.postalCode}
            <br />
            {shippingAddress.country}
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                className={errors.cardNumber ? 'border-destructive' : ''}
                value={formData.cardNumber}
                onChange={handleChange('cardNumber')}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
              />
              {errors.cardNumber && <p className="text-sm text-destructive">{errors.cardNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardholderName">Cardholder Name</Label>
              <Input
                id="cardholderName"
                type="text"
                className={errors.cardholderName ? 'border-destructive' : ''}
                value={formData.cardholderName}
                onChange={handleChange('cardholderName')}
                placeholder="John Doe"
              />
              {errors.cardholderName && <p className="text-sm text-destructive">{errors.cardholderName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="text"
                  inputMode="numeric"
                  className={errors.expiryDate ? 'border-destructive' : ''}
                  value={formData.expiryDate}
                  onChange={handleChange('expiryDate')}
                  placeholder="MM/YY"
                  maxLength={5}
                />
                {errors.expiryDate && <p className="text-sm text-destructive">{errors.expiryDate}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="text"
                  inputMode="numeric"
                  className={errors.cvv ? 'border-destructive' : ''}
                  value={formData.cvv}
                  onChange={handleChange('cvv')}
                  placeholder="123"
                  maxLength={4}
                />
                {errors.cvv && <p className="text-sm text-destructive">{errors.cvv}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Card Info */}
        <Card className="bg-amber-50 border-amber-300">
          <CardContent className="pt-6">
            <p className="text-sm space-y-1">
              <strong>Test Cards:</strong><br />
              ✅ Any card number = Success<br />
              ❌ Ending in 0000 = Declined (insufficient funds)<br />
              ❌ Ending in 1111 = Declined (invalid card)<br />
              ❌ Ending in 9999 = Gateway error
            </p>
          </CardContent>
        </Card>

        {(generalError || mutation.error) && (
          <Alert variant="destructive">
            <AlertDescription>
              {generalError
                ? generalError
                : 'An error occurred while processing your payment. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/shipping')}
          >
            Back
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? 'Processing Payment...'
              : `Pay ${cart ? formatCurrency(cart.grandTotal, cart.currency) : ''}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
