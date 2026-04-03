/**
 * Paystack Split Payments Utility
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function createSplit(name, type, subaccounts) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    const totalShare = subaccounts.reduce((sum, acc) => sum + acc.share, 0);
    if (type === 'percentage' && totalShare !== 100) {
      throw new Error(`Percentage shares must add up to 100, got ${totalShare}`);
    }

    const payload = { name, type, subaccounts };

    const response = await fetch(`${PAYSTACK_BASE_URL}/split`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Failed to create split'}`);
    }

    console.log('Split created successfully:', data);
    return data;
  } catch (error) {
    console.error('Create Split Error:', error.message);
    throw error;
  }
}

async function getSplit(splitId) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/split/${splitId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Failed to get split'}`);
    }

    return data;
  } catch (error) {
    console.error('Get Split Error:', error.message);
    throw error;
  }
}

async function listSplits() {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/split`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Failed to list splits'}`);
    }

    return data.data || [];
  } catch (error) {
    console.error('List Splits Error:', error.message);
    throw error;
  }
}

async function updateSplit(splitId, updates) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/split/${splitId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API Error: ${data.message || 'Failed to update split'}`);
    }

    return data;
  } catch (error) {
    console.error('Update Split Error:', error.message);
    throw error;
  }
}

module.exports = { createSplit, getSplit, listSplits, updateSplit };
