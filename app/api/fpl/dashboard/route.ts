import { NextRequest, NextResponse } from 'next/server';
import { getDashboard } from '@/lib/fpl-data';

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('id')?.trim();
  if (!value || !/^\d+$/.test(value)) {
    return NextResponse.json({ error: 'Enter a valid numeric FPL Manager ID.' }, { status: 400 });
  }

  try {
    const data = await getDashboard(Number(value));
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600',
      },
    });
  } catch (reason) {
    const status = (reason as Error & { status?: number }).status;
    if (status === 404) return NextResponse.json({ error: 'No FPL manager was found with that ID.' }, { status: 404 });
    return NextResponse.json({ error: 'FPL data is temporarily unavailable. Try again shortly.' }, { status: 502 });
  }
}
