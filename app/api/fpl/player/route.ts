import { NextRequest, NextResponse } from 'next/server';
import { getPlayerSummary } from '@/lib/fpl-data';

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('id')?.trim();
  if (!value || !/^\d+$/.test(value)) {
    return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await getPlayerSummary(Number(value)));
  } catch {
    return NextResponse.json({ error: 'Player history is temporarily unavailable.' }, { status: 502 });
  }
}
