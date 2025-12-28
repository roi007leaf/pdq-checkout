import { Navigate, Route, Routes } from 'react-router-dom';
import { CheckoutProvider } from './context/CheckoutContext';
import { CartPage } from './pages/CartPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { PaymentPage } from './pages/PaymentPage';
import { ShippingPage } from './pages/ShippingPage';

export function App() {
  return (
    <CheckoutProvider>
      <div className="min-h-screen flex flex-col">
        <header className="bg-white/95 backdrop-blur-md border-b border-purple-200/50 sticky top-0 z-50 shadow-lg shadow-purple-100/50">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 bg-clip-text text-transparent">
              PDQ Checkout
            </h1>
          </div>
        </header>
        <main className="flex-1">
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
