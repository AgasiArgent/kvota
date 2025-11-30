import { NextRequest, NextResponse } from 'next/server';
import { getApiEndpoint } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: true, message: 'Not authenticated' }, { status: 401 });
    }

    const response = await fetch(getApiEndpoint('/api/exchange-rates/refresh'), {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Exchange rate refresh error:', error);
    return NextResponse.json(
      { error: true, message: 'Failed to refresh exchange rates' },
      { status: 500 }
    );
  }
}
