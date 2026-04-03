'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export default function CheckoutPage() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  // Load Paystack script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePaymentCallback = async (response: any) => {
    try {
      // Verify payment on backend
      const verifyRes = await fetch('/api/admin/finance/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: response.reference,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(verifyData.message || 'Verification failed');
      }

      setSuccess({
        reference: response.reference,
        amount: parseFloat(amount),
        email: email,
        status: verifyData.data?.status,
      });

      setEmail('');
      setAmount('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      const amountInKobo = Math.round(parseFloat(amount) * 100);

      if (!email.trim()) {
        throw new Error('Email is required');
      }

      if (!amountInKobo || amountInKobo <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (!window.PaystackPop) {
        throw new Error('Paystack failed to load. Please refresh and try again.');
      }

      // Generate unique reference
      const reference = 'ref_' + Math.floor(Math.random() * 1000000000);

      window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: email.trim(),
        amount: amountInKobo,
        ref: reference,
        split_code: '7874206', // Your Split ID
        onClose: () => {
          setLoading(false);
          setError('Payment window closed');
        },
        callback: handlePaymentCallback,
      });

      window.PaystackPop.openIframe();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Checkout</h1>
          <p className="text-sm text-gray-600 mb-8">
            Payments will automatically route to your subaccount
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex gap-3 mb-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-semibold text-green-900">Payment Successful!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Funds sent to your subaccount
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 bg-white p-3 rounded border border-green-100">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Reference:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {success.reference}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Amount:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    ₦{success.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Email:</span>
                  <span className="text-sm text-gray-900">{success.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className="text-sm text-green-600 capitalize font-semibold">
                    {success.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleCheckout} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1.5">
                Amount (₦)
              </label>
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter amount in Naira
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Processing...' : 'Pay Now'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>Split ID:</strong> 7874206 — All payments will be routed to your configured subaccount
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
