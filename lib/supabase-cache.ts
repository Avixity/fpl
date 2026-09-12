type CacheRecord<T> = { payload: T; expires_at: string };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

function headers(key: string, extra?: HeadersInit): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'User-Agent': 'fpl-server/1.0',
    ...extra,
  };
}

export async function readCache<T>(cacheKey: string): Promise<T | null> {
  const settings = config();
  if (!settings) return null;

  try {
    const endpoint = `${settings.url}/rest/v1/api_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,expires_at&limit=1`;
    const response = await fetch(endpoint, { headers: headers(settings.key), signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const rows = (await response.json()) as CacheRecord<T>[];
    const row = rows[0];
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
    return row.payload;
  } catch {
    return null;
  }
}

export async function writeCache(cacheKey: string, payload: unknown, ttlSeconds: number): Promise<void> {
  const settings = config();
  if (!settings) return;

  try {
    await fetch(`${settings.url}/rest/v1/api_cache?on_conflict=cache_key`, {
      method: 'POST',
      headers: headers(settings.key, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        cache_key: cacheKey,
        payload,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Supabase cache failure must never block fresh FPL data.
  }
}

export async function recordPredictionRun(managerId: number, gameweek: number | null, payload: unknown): Promise<void> {
  const settings = config();
  if (!settings) return;

  try {
    await fetch(`${settings.url}/rest/v1/prediction_runs`, {
      method: 'POST',
      headers: headers(settings.key, { Prefer: 'return=minimal' }),
      body: JSON.stringify({
        fpl_manager_id: managerId,
        target_gameweek: gameweek,
        model_version: 'v1.0.0',
        payload,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Prediction persistence is best effort; the calculation is still returned.
  }
}
