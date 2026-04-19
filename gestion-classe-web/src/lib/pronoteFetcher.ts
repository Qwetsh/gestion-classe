import type { Fetcher } from '@literate.ink/utilities';

// In dev, use the Vite middleware proxy. In production, use Supabase Edge Function.
const SUPABASE_URL = 'https://djodkjysovalpufgevrr.supabase.co';

function getProxyUrl(targetUrl: string): string {
  if (import.meta.env.DEV) {
    return `/api/pronote-proxy?url=${encodeURIComponent(targetUrl)}`;
  }
  return `${SUPABASE_URL}/functions/v1/pronote-proxy?url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Custom fetcher for Pawnote that routes requests through a proxy
 * to avoid CORS issues when calling Pronote servers from the browser.
 */
export const pronoteFetcher: Fetcher = async (req) => {
  const targetUrl = req.url.toString();
  const proxyUrl = getProxyUrl(targetUrl);

  const headers: Record<string, string> = {};
  if (req.headers) {
    if (req.headers instanceof Headers) {
      req.headers.forEach((val, key) => {
        headers[`x-pronote-${key}`] = val;
      });
    } else {
      for (const [key, val] of Object.entries(req.headers)) {
        headers[`x-pronote-${key}`] = val;
      }
    }
  }

  if (req.content) {
    headers['content-type'] = headers['content-type'] || headers['x-pronote-content-type'] || 'application/x-www-form-urlencoded';
  }

  const response = await fetch(proxyUrl, {
    method: req.method || 'GET',
    headers,
    body: req.content || undefined,
    redirect: req.redirect || 'follow',
  });

  const content = await response.text();

  // Build headers map
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((val, key) => {
    responseHeaders[key] = val;
  });

  return {
    status: response.status,
    content,
    headers: responseHeaders,
  };
};
