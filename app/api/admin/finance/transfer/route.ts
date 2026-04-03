import { transferToSubaccount } from '@/lib/paystack-transfer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, subaccountCode, reason } = body;

    // Validate input
    if (!amount || !subaccountCode) {
      return NextResponse.json(
        { error: 'Amount and subaccount code are required' },
        { status: 400 }
      );
    }

    // Call the transfer function
    const result = await transferToSubaccount(amount, subaccountCode, reason);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Transfer API Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to initiate transfer',
        message: error.message || 'Failed to initiate transfer',
      },
      { status: 500 }
    );
  }
}
