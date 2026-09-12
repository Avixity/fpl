import { NextRequest, NextResponse } from 'next/server';

const FPL_API = 'https://fantasy.premierleague.com/api';

export async function GET(request: NextRequest) {
  const managerId = request.nextUrl.searchParams.get('id')?.trim();

  if (!managerId || !/^\d+$/.test(managerId)) {
    return NextResponse.json({ error: 'Enter a valid numeric FPL Manager ID.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${FPL_API}/entry/${managerId}/`, {
      headers: { 'User-Agent': 'FPL decision dashboard/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 404) {
      return NextResponse.json({ error: 'No FPL manager was found with that ID.' }, { status: 404 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'FPL is unavailable right now. Try again shortly.' }, { status: 502 });
    }

    const manager = await response.json();
    return NextResponse.json(manager, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to reach FPL right now.' }, { status: 502 });
  }
}
