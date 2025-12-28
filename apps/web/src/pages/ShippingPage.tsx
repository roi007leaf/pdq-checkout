import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { checkoutApi, ShippingAddress } from '../api/checkout';
import { useCheckout } from '../context/CheckoutContext';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { ApiException } from '../api/client';

interface FormErrors {
  [key: string]: string;
}

export function ShippingPage() {
  const navigate = useNavigate();
  const { setShippingAddress } = useCheckout();

  const [formData, setFormData] = useState<ShippingAddress>({
    fullName: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const mutation = useMutation({
    mutationFn: (address: ShippingAddress) => checkoutApi.validateShipping(address),
    onSuccess: (data) => {
      setShippingAddress(data.shippingAddress);
      navigate('/payment');
    },
    onError: (error) => {
      if (error instanceof ApiException && error.error.errors) {
        const newErrors: FormErrors = {};
        error.error.errors.forEach((e) => {
          newErrors[e.field] = e.message;
        });
        setErrors(newErrors);
      }
    },
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.streetAddress.trim()) {
      newErrors.streetAddress = 'Street address is required';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!formData.stateProvince.trim()) {
      newErrors.stateProvince = 'State/Province is required';
    }
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      mutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof ShippingAddress) => (
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
      <CheckoutSteps current="shipping" />

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2 className="card-title">Shipping Address</h2>

          <div className="form-group">
            <label className="form-label" htmlFor="fullName">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              className={`form-input ${errors.fullName ? 'error' : ''}`}
              value={formData.fullName}
              onChange={handleChange('fullName')}
              placeholder="John Doe"
            />
            {errors.fullName && <div className="form-error">{errors.fullName}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="streetAddress">
              Street Address
            </label>
            <input
              id="streetAddress"
              type="text"
              className={`form-input ${errors.streetAddress ? 'error' : ''}`}
              value={formData.streetAddress}
              onChange={handleChange('streetAddress')}
              placeholder="123 Main St"
            />
            {errors.streetAddress && (
              <div className="form-error">{errors.streetAddress}</div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="city">
                City
              </label>
              <input
                id="city"
                type="text"
                className={`form-input ${errors.city ? 'error' : ''}`}
                value={formData.city}
                onChange={handleChange('city')}
                placeholder="New York"
              />
              {errors.city && <div className="form-error">{errors.city}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="stateProvince">
                State/Province
              </label>
              <input
                id="stateProvince"
                type="text"
                className={`form-input ${errors.stateProvince ? 'error' : ''}`}
                value={formData.stateProvince}
                onChange={handleChange('stateProvince')}
                placeholder="NY"
              />
              {errors.stateProvince && (
                <div className="form-error">{errors.stateProvince}</div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="postalCode">
                Postal Code
              </label>
              <input
                id="postalCode"
                type="text"
                className={`form-input ${errors.postalCode ? 'error' : ''}`}
                value={formData.postalCode}
                onChange={handleChange('postalCode')}
                placeholder="10001"
              />
              {errors.postalCode && (
                <div className="form-error">{errors.postalCode}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="country">
                Country
              </label>
              <input
                id="country"
                type="text"
                className={`form-input ${errors.country ? 'error' : ''}`}
                value={formData.country}
                onChange={handleChange('country')}
                placeholder="United States"
              />
              {errors.country && <div className="form-error">{errors.country}</div>}
            </div>
          </div>
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
            onClick={() => navigate('/cart')}
          >
            Back to Cart
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
                Validating...
              </>
            ) : (
              'Continue to Payment'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
