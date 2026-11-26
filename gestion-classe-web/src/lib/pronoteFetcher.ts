import type { Fetcher } from '@literate.ink/utilities';
import { supabase } from './supabase';

// In dev, use the Vite middleware proxy. In production, use Supabase Edge Function.
const SUPABASE_URL = 'https://djodkjysovalpufgevrr.supabase.co';

function getProxyUrl(targetUrl: string): string {
  if (import.meta.env.DEV) {
    return `/api/pronote-proxy?url=${encodeURIComponent(targetUrl)}`;
  }
  return `${SUPABASE_URL}/functions/v1/pronote-proxy?url=${encodeURIComponent(targetUrl)}`;
}

/** Refus du relais (en-tête `x-gc-proxy-error`) traduits pour l'enseignant. */
const PROXY_ERRORS: Record<string, string> = {
  unauthorized: 'Reconnectez-vous à Gestion Classe pour utiliser Pronote.',
  host_not_allowed: "Cette adresse Pronote n'est pas reconnue. Vérifiez l'adresse, ou demandez à l'ajouter.",
};

/**
 * Custom fetcher for Pawnote that routes requests through a proxy
 * to avoid CORS issues when calling Pronote servers from the browser.
 *
 * Le relais n'accepte que les enseignants connectés : le jeton de session part dans
 * `Authorization` (il n'est pas transmis à Pronote, seuls les en-têtes `x-pronote-*` le sont).
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

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

  const response = await fetch(proxyUrl, {
    method: req.method || 'GET',
    headers,
    body: req.content || undefined,
    redirect: req.redirect || 'follow',
  });

  const refused = response.headers.get('x-gc-proxy-error');
  if (refused && PROXY_ERRORS[refused]) throw new Error(PROXY_ERRORS[refused]);

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
