import type { Fetcher } from '@literate.ink/utilities';

/**
 * Custom fetcher for Pawnote that routes requests through our Vite proxy
 * to avoid CORS issues when calling Pronote servers from the browser.
 */
export const pronoteFetcher: Fetcher = async (req) => {
  const targetUrl = req.url.toString();
  const proxyUrl = `/api/pronote-proxy?url=${encodeURIComponent(targetUrl)}`;

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
