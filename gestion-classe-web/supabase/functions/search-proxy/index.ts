// Edge Function « search-proxy » : recherche web (Brave Search API) pour le tableau blanc.
// La clé BRAVE_API_KEY reste ici, côté serveur ; le navigateur n'y a jamais accès.
//
// Déployée le 10/09/2026 (verify_jwt activé : appel depuis l'app connectée).
// Secret : supabase secrets set BRAVE_API_KEY=…   (offre gratuite : 2 000 requêtes / mois)
// Sans secret, la fonction répond 500 « BRAVE_API_KEY manquante » et le client bascule sur Wikipédia.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const key = Deno.env.get('BRAVE_API_KEY');
  if (!key) return Response.json({ error: 'BRAVE_API_KEY manquante' }, { status: 500, headers: CORS });
  let q = '';
  let count = 10;
  try {
    const body = await req.json();
    q = String(body.q ?? '').trim();
    count = Math.max(1, Math.min(20, Number(body.count) || 10));
  } catch {
    return Response.json({ error: 'Corps JSON attendu' }, { status: 400, headers: CORS });
  }
  if (!q) return Response.json({ results: [] }, { headers: CORS });

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}&country=FR&search_lang=fr&safesearch=strict`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
  if (!res.ok) return Response.json({ error: `Brave ${res.status}` }, { status: 502, headers: CORS });
  const data = await res.json();
  const results = (data?.web?.results ?? []).map((r: { title: string; url: string; description?: string; thumbnail?: { src?: string } }) => ({
    title: r.title,
    url: r.url,
    description: r.description,
    thumbnail: r.thumbnail?.src,
  }));
  return Response.json({ results }, { headers: CORS });
});
