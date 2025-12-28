import { createContext, ReactNode, useContext, useState } from 'react';

export interface ShippingAddress {
  fullName: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

interface CheckoutState {
  shippingAddress: ShippingAddress | null;
  setShippingAddress: (address: ShippingAddress) => void;
  clearCheckout: () => void;
}

const CheckoutContext = createContext<CheckoutState | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);

  const clearCheckout = () => {
    setShippingAddress(null);
  };

  return (
    <CheckoutContext.Provider value={{ shippingAddress, setShippingAddress, clearCheckout }}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout(): CheckoutState {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
}
