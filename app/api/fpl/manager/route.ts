import { NextRequest, NextResponse } from 'next/server';
import { fetchFplJson, FplUpstreamError } from '@/lib/fpl-client';

export async function GET(request: NextRequest) {
  const managerId = request.nextUrl.searchParams.get('id')?.trim();

  if (!managerId || !/^\d+$/.test(managerId)) {
    return NextResponse.json({ error: 'Enter a valid numeric FPL Manager ID.' }, { status: 400 });
  }

  try {
    const manager = await fetchFplJson(`/entry/${managerId}/`);
    return NextResponse.json(manager, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (reason) {
    if (reason instanceof FplUpstreamError && reason.status === 404) {
      return NextResponse.json({ error: 'No FPL manager was found with that ID.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to reach FPL right now.' }, { status: 502 });
  }
}
