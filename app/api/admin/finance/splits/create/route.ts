import { createSplit } from '@/lib/paystack-splits';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, subaccounts } = body;

    // Validate input
    if (!name || !type || !subaccounts) {
      return NextResponse.json(
        { error: 'Name, type, and subaccounts are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(subaccounts) || subaccounts.length === 0) {
      return NextResponse.json(
        { error: 'At least one subaccount is required' },
        { status: 400 }
      );
    }

    // Call the split creation function
    const result = await createSplit(name, type, subaccounts);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Split API Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to create split',
        message: error.message || 'Failed to create split',
      },
      { status: 500 }
    );
  }
}
