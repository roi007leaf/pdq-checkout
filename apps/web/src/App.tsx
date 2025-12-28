import { Routes, Route, Navigate } from 'react-router-dom';
import { CartPage } from './pages/CartPage';
import { ShippingPage } from './pages/ShippingPage';
import { PaymentPage } from './pages/PaymentPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { CheckoutProvider } from './context/CheckoutContext';

export function App() {
  return (
    <CheckoutProvider>
      <div className="app">
        <header className="header">
          <h1>PDQ Checkout</h1>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/cart" replace />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/confirmation/:orderId" element={<ConfirmationPage />} />
          </Routes>
        </main>
      </div>
    </CheckoutProvider>
  );
}
