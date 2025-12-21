import { NextRequest, NextResponse } from 'next/server';
import { getApiEndpoint } from '@/lib/config';

/**
 * Public endpoint - no authentication required.
 * Exchange rates are public data from Central Bank of Russia.
 */
export async function GET(_request: NextRequest) {
  try {
    // Fetch all exchange rates from backend (cached in memory)
    const response = await fetch(getApiEndpoint('/api/exchange-rates/all'), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch exchange rates: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Exchange rates fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
