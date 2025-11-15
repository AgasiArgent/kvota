import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ from: string; to: string }> }
) {
  try {
    // In Next.js 15, params is now a Promise
    const { from, to } = await params;

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch exchange rate from backend
    const response = await fetch(`http://localhost:8000/api/exchange-rates/${from}/${to}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch exchange rate: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
