'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

export default function TransferPage() {
  const [amount, setAmount] = useState('');
  const [subaccountCode, setSubaccountCode] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResponse(null);
    setLoading(true);

    try {
      // Convert naira to kobo (multiply by 100)
      const amountInKobo = Math.round(parseFloat(amount) * 100);

      if (!amountInKobo || amountInKobo <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (!subaccountCode.trim()) {
        throw new Error('Please enter a subaccount code');
      }

      const res = await fetch('/api/admin/finance/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInKobo,
          subaccountCode: subaccountCode.trim(),
          reason: reason.trim() || 'Transfer to subaccount',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Transfer failed');
      }

      setResponse(data);
      setAmount('');
      setSubaccountCode('');
      setReason('');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Send Transfer</h1>
          <p className="text-sm text-gray-600 mb-8">
            Send money to your Paystack subaccount
          </p>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {response && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex gap-3 mb-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-semibold text-green-900">Transfer Initiated</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Your transfer has been submitted successfully
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 bg-white p-3 rounded border border-green-100">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Reference:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {response.data?.reference || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className="text-sm text-gray-900 capitalize">
                    {response.data?.status || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Amount:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    ₦{(response.data?.amount / 100).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="e.g., 5000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Amount will be converted to kobo for the API
              </p>
            </div>

            <div>
              <label htmlFor="subaccount" className="block text-sm font-medium text-gray-700 mb-1.5">
                Subaccount Code
              </label>
              <input
                type="text"
                id="subaccount"
                value={subaccountCode}
                onChange={(e) => setSubaccountCode(e.target.value)}
                placeholder="e.g., ACCT_xxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the subaccount code you created in Paystack
              </p>
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1.5">
                Reason (Optional)
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Monthly commission payout"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Processing...' : 'Send Transfer'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Your Paystack account must have the Transfers feature enabled. Check your Paystack dashboard for more details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
