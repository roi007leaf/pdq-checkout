import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkoutApi, ShippingAddress } from '../api/checkout';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { useCheckout } from '../context/CheckoutContext';
import { parseApiFieldErrors } from '../utils/apiErrors';

interface FormErrors {
  [key: string]: string;
}

const VALID_COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Ireland',
  'New Zealand',
  'Japan',
  'Singapore',
] as const;

export function ShippingPage() {
  const navigate = useNavigate();
  const { setShippingAddress } = useCheckout();

  const [formData, setFormData] = useState<ShippingAddress>({
    fullName: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: 'United States',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const shippingFieldMap: Record<string, string> = {
    fullname: 'fullName',
    name: 'fullName',
    street: 'streetAddress',
    streetaddress: 'streetAddress',
    address: 'streetAddress',
    city: 'city',
    state: 'stateProvince',
    province: 'stateProvince',
    stateprovince: 'stateProvince',
    postalcode: 'postalCode',
    zipcode: 'postalCode',
    zip: 'postalCode',
    country: 'country',
  };

  const mutation = useMutation({
    mutationFn: (address: ShippingAddress) => checkoutApi.validateShipping(address),
    onSuccess: (data) => {
      setShippingAddress(data.shippingAddress);
      setGeneralError(null);
      navigate('/payment');
    },
    onError: (error) => {
      const parsed = parseApiFieldErrors(error, {
        fieldMap: shippingFieldMap,
        preferLastPathSegment: true,
        generalMessage: 'Please correct the highlighted fields and try again.',
      });
      setErrors(parsed.formErrors);
      setGeneralError(parsed.unmapped.length > 0 ? parsed.generalMessage || null : null);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Full name: Must be capitalized first and last name
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (!/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(formData.fullName.trim())) {
      newErrors.fullName = 'Enter first and last name with proper capitalization (e.g., "John Doe")';
    }

    // Street address: Must start with number
    if (!formData.streetAddress.trim()) {
      newErrors.streetAddress = 'Street address is required';
    } else if (!/^\d+\s+[A-Za-z0-9\s,.-]+$/.test(formData.streetAddress.trim())) {
      newErrors.streetAddress = 'Address must start with a number (e.g., "123 Main St")';
    }

    // City: Must start with capital letter
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    } else if (!/^[A-Z][a-zA-Z\s.'-]+$/.test(formData.city.trim())) {
      newErrors.city = 'City must start with a capital letter (e.g., "New York")';
    }

    // State/Province: 2-letter code or full name
    if (!formData.stateProvince.trim()) {
      newErrors.stateProvince = 'State/Province is required';
    } else if (!/^[A-Z]{2}$|^[A-Z][a-zA-Z\s.'-]+$/.test(formData.stateProvince.trim())) {
      newErrors.stateProvince = 'Enter 2-letter code (e.g., "CA") or full name (e.g., "California")';
    }

    // Postal code: Format depends on country
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    } else {
      const postal = formData.postalCode.trim();
      switch (formData.country) {
        case 'United States':
          if (!/^\d{5}(-\d{4})?$/.test(postal)) {
            newErrors.postalCode = 'US ZIP must be 12345 or 12345-6789';
          }
          break;
        case 'Canada':
          if (!/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(postal)) {
            newErrors.postalCode = 'Canadian postal code must be A1A 1A1';
          }
          break;
        case 'United Kingdom':
          if (!/^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/.test(postal)) {
            newErrors.postalCode = 'UK postal code must be AA11 1AA';
          }
          break;
        case 'Australia':
          if (!/^\d{4}$/.test(postal)) {
            newErrors.postalCode = 'Australian postal code must be 4 digits';
          }
          break;
        default:
          if (!/^[A-Z0-9\s-]{3,10}$/.test(postal)) {
            newErrors.postalCode = 'Postal code must be 3-10 characters';
          }
      }
    }

    // Country: Must be from valid list
    if (!formData.country) {
      newErrors.country = 'Country is required';
    } else if (!VALID_COUNTRIES.includes(formData.country as any)) {
      newErrors.country = 'Please select a valid country';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setGeneralError(null);
      mutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof ShippingAddress) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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

  const getPostalCodePlaceholder = () => {
    switch (formData.country) {
      case 'United States':
        return '12345';
      case 'Canada':
        return 'A1A 1A1';
      case 'United Kingdom':
        return 'SW1A 1AA';
      case 'Australia':
        return '2000';
      default:
        return 'Postal Code';
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
      <CheckoutSteps current="shipping" />

      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                className={errors.fullName ? 'border-destructive' : ''}
                value={formData.fullName}
                onChange={handleChange('fullName')}
                placeholder="John Doe"
              />
              <p className="text-xs text-muted-foreground">First and last name with capital letters</p>
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input
                id="streetAddress"
                type="text"
                className={errors.streetAddress ? 'border-destructive' : ''}
                value={formData.streetAddress}
                onChange={handleChange('streetAddress')}
                placeholder="123 Main St"
              />
              <p className="text-xs text-muted-foreground">Must start with a street number</p>
              {errors.streetAddress && <p className="text-sm text-destructive">{errors.streetAddress}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  className={errors.city ? 'border-destructive' : ''}
                  value={formData.city}
                  onChange={handleChange('city')}
                  placeholder="New York"
                />
                {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="stateProvince">State/Province</Label>
                <Input
                  id="stateProvince"
                  type="text"
                  className={errors.stateProvince ? 'border-destructive' : ''}
                  value={formData.stateProvince}
                  onChange={handleChange('stateProvince')}
                  placeholder="NY or New York"
                />
                {errors.stateProvince && <p className="text-sm text-destructive">{errors.stateProvince}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  type="text"
                  className={errors.postalCode ? 'border-destructive' : ''}
                  value={formData.postalCode}
                  onChange={handleChange('postalCode')}
                  placeholder={getPostalCodePlaceholder()}
                />
                {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  id="country"
                  className={errors.country ? 'border-destructive' : ''}
                  value={formData.country}
                  onChange={handleChange('country')}
                >
                  {VALID_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </Select>
                {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/cart')}
          >
            Back to Cart
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Validating...' : 'Continue to Payment'}
          </Button>
        </div>
      </form>
    </div>
  );
}

