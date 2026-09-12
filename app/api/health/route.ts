import { NextResponse } from 'next/server';

export async function GET() {
  const groq = Boolean(process.env.GROQ_API_KEY);
  const supabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  return NextResponse.json({ fpl: true, groq, supabase });
}
