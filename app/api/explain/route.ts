import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_KINDS = new Set(['captain', 'transfer', 'comparison', 'squad']);

export async function POST(request: NextRequest) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: 'Groq is not configured.' }, { status: 503 });

  const body = (await request.json()) as { kind?: string; result?: unknown };
  if (!body.kind || !ALLOWED_KINDS.has(body.kind) || body.result === undefined) {
    return NextResponse.json({ error: 'Invalid explanation request.' }, { status: 400 });
  }
  const serialized = JSON.stringify(body.result);
  if (serialized.length > 12000) return NextResponse.json({ error: 'Result is too large to explain.' }, { status: 413 });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        temperature: 0.2,
        max_completion_tokens: 320,
        messages: [
          {
            role: 'system',
            content:
              'You explain structured Fantasy Premier League model results. The supplied algorithmic result is the source of truth. Use only facts and numbers in the JSON. Never invent injuries, fixtures, news, prices, probabilities, or predictions. Write 2-4 concise sentences, mention uncertainty when confidence is not high, and call projected points xPts.',
          },
          { role: 'user', content: `Explain this ${body.kind} result:\n${serialized}` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return NextResponse.json({ error: 'Explanation is temporarily unavailable.' }, { status: 502 });
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const explanation = payload.choices?.[0]?.message?.content?.trim();
    if (!explanation) return NextResponse.json({ error: 'Explanation is temporarily unavailable.' }, { status: 502 });
    return NextResponse.json({ explanation, source: 'Groq explanation of app model output' });
  } catch {
    return NextResponse.json({ error: 'Explanation is temporarily unavailable.' }, { status: 502 });
  }
}
