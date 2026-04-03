import { NextRequest, NextResponse } from 'next/server';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    // Verify payment with Paystack
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify payment');
    }

    if (!data.status || data.data?.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed', data },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: true,
      message: 'Payment verified successfully',
      data: {
        reference: data.data.reference,
        amount: data.data.amount,
        status: data.data.status,
        customer: data.data.customer,
        authorization: data.data.authorization,
      },
    });
  } catch (error: any) {
    console.error('Verification Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to verify payment',
        message: error.message || 'Failed to verify payment',
      },
      { status: 500 }
    );
  }
}
