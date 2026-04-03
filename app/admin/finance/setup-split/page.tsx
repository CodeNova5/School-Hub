'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, Copy } from 'lucide-react';

export default function SetupSplitPage() {
  const [splitName, setSplitName] = useState('School Fees Split');
  const [subaccountCode, setSubaccountCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResponse(null);
    setLoading(true);

    try {
      if (!subaccountCode.trim()) {
        throw new Error('Subaccount code is required');
      }

      const res = await fetch('/api/admin/finance/splits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: splitName,
          type: 'percentage',
          subaccounts: [
            {
              subaccount_code: subaccountCode.trim(),
              share: 100,
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create split');
      }

      setResponse(data);
      setSplitName('School Fees Split');
      setSubaccountCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copySplitId = () => {
    if (response?.data?.id) {
      navigator.clipboard.writeText(response.data.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Payment Split</h1>
          <p className="text-sm text-gray-600 mb-8">
            Create a split that sends 100% of checkout payments to your subaccount
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

          {response && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex gap-3 mb-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-semibold text-green-900">Split Created!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Save this Split ID for your checkout integration
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white rounded border border-green-100 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Split ID:</p>
                    <p className="text-sm font-mono font-medium text-gray-900">
                      {response.data?.id}
                    </p>
                  </div>
                  <button
                    onClick={copySplitId}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy Split ID"
                  >
                    <Copy
                      size={18}
                      className={copied ? 'text-green-600' : 'text-gray-600'}
                    />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Subaccount:</p>
                  <p className="text-sm font-mono text-gray-900">
                    {response.data?.subaccounts?.[0]?.subaccount_code}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-blue-700 font-medium">
                    💡 Use this Split ID in your checkout with: <code className="bg-blue-50 px-1 rounded">split_code: "{response.data?.id}"</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateSplit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Split Name
              </label>
              <input
                type="text"
                id="name"
                value={splitName}
                onChange={(e) => setSplitName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive name for this split configuration
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
                placeholder="ACCT_xxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                100% of payments will be distributed to this subaccount
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Creating Split...' : 'Create Split'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> After creating the split, you can use the Split ID in your Paystack checkout to automatically route all payments to your subaccount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
