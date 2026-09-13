const FPL_API = 'https://fantasy.premierleague.com/api';

const FPL_HEADERS: HeadersInit = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  Referer: 'https://fantasy.premierleague.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

export class FplUpstreamError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FplUpstreamError';
    this.status = status;
  }
}

function normalizedPath(path: string): string {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const [pathname, query] = withLeadingSlash.split('?', 2);
  const withTrailingSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return query ? `${withTrailingSlash}?${query}` : withTrailingSlash;
}

function retryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Fetches the same public JSON used by the official FPL web client.
 * FPL's edge rejects generic server/bot user agents from some hosting networks,
 * so every server-side request deliberately carries a normal browser request
 * profile and the official site as its referrer.
 */
export async function fetchFplJson<T>(
  path: string,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retries ?? 1;
  let lastError: FplUpstreamError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${FPL_API}${normalizedPath(path)}`, {
        headers: FPL_HEADERS,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) return (await response.json()) as T;

      lastError = new FplUpstreamError(`FPL request failed with ${response.status}`, response.status);
      if (!retryable(response.status)) throw lastError;
    } catch (reason) {
      if (reason instanceof FplUpstreamError && !retryable(reason.status ?? 0)) throw reason;
      lastError =
        reason instanceof FplUpstreamError
          ? reason
          : new FplUpstreamError(reason instanceof Error ? reason.message : 'FPL request failed');
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError ?? new FplUpstreamError('FPL request failed');
}
