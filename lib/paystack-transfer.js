/**
 * Paystack Transfer Utility
 * Send money to a Paystack subaccount
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Initiate a transfer to a subaccount
 * @param {number} amount - Amount in kobo (e.g., 100000 for ₦1000)
 * @param {string} subaccountCode - The subaccount code (e.g., 'ACCT_xxxx')
 * @param {string} reason - Transfer reason/description
 * @returns {Promise<object>} - Transfer response from Paystack
 */
async function transferToSubaccount(amount, subaccountCode, reason = 'Transfer to subaccount') {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!subaccountCode) {
      throw new Error('Subaccount code is required');
    }

    const payload = {
      type: 'subaccount', // Or 'nuban' if using account details
      amount: amount, // in kobo
      recipient: subaccountCode, // Your subaccount code
      reason: reason,
    };

    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Unknown error'}`);
    }

    console.log('Transfer initiated successfully:', data);
    return data;
  } catch (error) {
    console.error('Transfer Error:', error.message);
    throw error;
  }
}

/**
 * Verify transfer status
 * @param {number} transferId - The transfer ID from Paystack
 * @returns {Promise<object>} - Transfer details
 */
async function getTransferStatus(transferId) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer/${transferId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error('Fetch Transfer Status Error:', error.message);
    throw error;
  }
}

/**
 * List all active subaccounts (for reference)
 * @returns {Promise<array>} - List of subaccounts
 */
async function getSubaccounts() {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/subaccount`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Unknown error'}`);
    }

    return data.data || [];
  } catch (error) {
    console.error('Fetch Subaccounts Error:', error.message);
    throw error;
  }
}

module.exports = {
  transferToSubaccount,
  getTransferStatus,
  getSubaccounts,
};

/**
 * USAGE EXAMPLE:
 *
 * const { transferToSubaccount } = require('./lib/paystack-transfer');
 *
 * // Transfer ₦5,000 to your subaccount
 * transferToSubaccount(
 *   500000, // Amount in kobo (5,000 naira)
 *   'ACCT_xxxxxx', // Your subaccount code
 *   'Payment for service'
 * )
 *   .then((response) => {
 *     console.log('Transfer Status:', response.data.status);
 *     console.log('Transfer Reference:', response.data.reference);
 *   })
 *   .catch((error) => {
 *     console.error('Failed:', error.message);
 *   });
 */
