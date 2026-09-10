// Edge Function « notion-proxy » : lecture d'une base Notion pour le tableau blanc
// (banque de ressources, idées de schémas…). Le jeton d'intégration reste côté serveur.
//
// Déployée le 10/09/2026 (verify_jwt activé : appel depuis l'app connectée).
// Secret : NOTION_TOKEN (connexion interne « Gestion Classe », bases partagées avec elle).
//
// Corps  { databaseId, query? } → { results: [{ id, title, text, image?, url }] }
//        toutes les entrées (pagination Notion suivie, 400 max), `text` = propriétés texte
//        et étiquettes (select / multi-select), filtre sur le titre et le texte.
// Corps  { pageId }             → { text, image, images: [{ url, caption }] }  premiers paragraphes
//        et toutes les images de la page (lu à la demande, pour rester rapide).
// Corps  { imageUrl }           → octets de l'image (relais de secours : les fichiers Notion sont
//        sur S3 avec URL signée ; le navigateur les lit en général directement).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION = 'https://api.notion.com/v1';
const MAX_ENTRIES = 400;
const MAX_BODY_CHARS = 1500;

type RichText = { plain_text: string }[];
type NotionProp = {
  type: string;
  title?: RichText;
  rich_text?: RichText;
  url?: string;
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  status?: { name: string } | null;
  number?: number | null;
  date?: { start: string } | null;
  files?: { name?: string; file?: { url: string }; external?: { url: string } }[];
};
type NotionPage = { id: string; url: string; cover?: { file?: { url: string }; external?: { url: string } } | null; properties: Record<string, NotionProp> };
type Block = { id: string; type: string; has_children?: boolean; [k: string]: unknown };

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
}

const text = (rt?: RichText) => (rt ?? []).map((t) => t.plain_text).join('');

/** Titre, texte (propriétés texte + étiquettes) et image d'une entrée. */
function summarize(page: NotionPage) {
  const props = Object.entries(page.properties);
  const title = text(props.find(([, p]) => p.type === 'title')?.[1].title) || 'Sans titre';
  const lines: string[] = [];
  for (const [name, p] of props) {
    if (p.type === 'rich_text') { const t = text(p.rich_text); if (t) lines.push(t); }
    else if (p.type === 'select' && p.select?.name) lines.push(`${name} : ${p.select.name}`);
    else if (p.type === 'status' && p.status?.name) lines.push(`${name} : ${p.status.name}`);
    else if (p.type === 'multi_select' && p.multi_select?.length) lines.push(`${name} : ${p.multi_select.map((s) => s.name).join(', ')}`);
    else if (p.type === 'number' && typeof p.number === 'number') lines.push(`${name} : ${p.number}`);
    else if (p.type === 'date' && p.date?.start) lines.push(`${name} : ${p.date.start}`);
    else if (p.type === 'url' && p.url) lines.push(p.url);
  }
  const fileProp = props.map(([, p]) => p).find((p) => p.type === 'files')?.files?.[0];
  const image = fileProp?.file?.url ?? fileProp?.external?.url ?? page.cover?.file?.url ?? page.cover?.external?.url ?? null;
  return { id: page.id, title, text: lines.join('\n'), image, url: page.url };
}

/** Blocs d'un conteneur (page, colonne, bascule…), pagination suivie. */
async function childBlocks(token: string, blockId: string, maxPages = 3): Promise<Block[]> {
  const out: Block[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const res = await fetch(`${NOTION}/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, { headers: headers(token) });
    if (!res.ok) break;
    const data = await res.json();
    out.push(...((data.results ?? []) as Block[]));
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return out;
}

/** Paragraphes (limités) et toutes les images du corps d'une page (un niveau d'imbrication). */
async function pageBody(token: string, pageId: string) {
  const paragraphs: string[] = [];
  const images: { url: string; caption: string }[] = [];
  let chars = 0;
  const visit = (blocks: Block[]) => {
    for (const b of blocks) {
      const inner = b[b.type] as { rich_text?: RichText; caption?: RichText; file?: { url: string }; external?: { url: string } } | undefined;
      if (b.type === 'image') {
        const url = inner?.file?.url ?? inner?.external?.url;
        if (url) images.push({ url, caption: text(inner?.caption) });
        continue;
      }
      const t = text(inner?.rich_text);
      if (!t || chars >= MAX_BODY_CHARS) continue;
      const prefix = b.type.startsWith('heading') ? '' : b.type === 'bulleted_list_item' ? '• ' : b.type === 'numbered_list_item' ? '1. ' : '';
      paragraphs.push(prefix + t);
      chars += t.length;
    }
  };
  const top = await childBlocks(token, pageId);
  visit(top);
  // Un niveau plus bas : colonnes, bascules, listes à sous-blocs (les images y sont souvent)
  const containers = top.filter((b) => b.has_children && ['column_list', 'column', 'toggle', 'bulleted_list_item', 'numbered_list_item', 'callout', 'quote', 'synced_block'].includes(b.type)).slice(0, 12);
  for (const c of containers) {
    const kids = await childBlocks(token, c.id, 1);
    visit(kids);
    if (c.type === 'column_list') {
      for (const col of kids.filter((k) => k.type === 'column').slice(0, 4)) visit(await childBlocks(token, col.id, 1));
    }
  }
  return { text: paragraphs.join('\n'), image: images[0]?.url ?? null, images };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const token = Deno.env.get('NOTION_TOKEN');
  if (!token) return Response.json({ error: 'NOTION_TOKEN manquant' }, { status: 500, headers: CORS });
  let body: { databaseId?: string; query?: string; pageId?: string; imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Corps JSON attendu' }, { status: 400, headers: CORS });
  }

  // Image d'une page ou d'une propriété : relayée telle quelle (domaines Notion seulement)
  if (body.imageUrl) {
    let u: URL;
    try { u = new URL(String(body.imageUrl)); } catch { return Response.json({ error: 'URL invalide' }, { status: 400, headers: CORS }); }
    const allowed = /(^|\.)(notion\.so|notion\.site|notionusercontent\.com|amazonaws\.com)$/i.test(u.hostname);
    if (!allowed) return Response.json({ error: 'Domaine non autorisé' }, { status: 400, headers: CORS });
    const res = await fetch(u.toString());
    if (!res.ok) return Response.json({ error: `Image ${res.status}` }, { status: 502, headers: CORS });
    const type = res.headers.get('content-type') ?? 'application/octet-stream';
    if (!type.startsWith('image/')) return Response.json({ error: 'Pas une image' }, { status: 400, headers: CORS });
    // application/octet-stream : c'est le seul type que supabase-js rend en Blob (image/* serait lu en texte)
    return new Response(await res.arrayBuffer(), { headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'X-Image-Type': type, 'Access-Control-Expose-Headers': 'X-Image-Type', 'Cache-Control': 'private, max-age=300' } });
  }

  // Contenu d'une page
  if (body.pageId) {
    const pageId = String(body.pageId).replace(/-/g, '');
    if (!/^[0-9a-f]{32}$/i.test(pageId)) return Response.json({ error: 'Identifiant de page invalide' }, { status: 400, headers: CORS });
    return Response.json(await pageBody(token, pageId), { headers: CORS });
  }

  // Entrées d'une base
  const databaseId = String(body.databaseId ?? '').replace(/-/g, '').trim();
  const query = String(body.query ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/i.test(databaseId)) return Response.json({ error: 'Identifiant de base Notion invalide' }, { status: 400, headers: CORS });

  const results: ReturnType<typeof summarize>[] = [];
  let cursor: string | undefined;
  while (results.length < MAX_ENTRIES) {
    const res = await fetch(`${NOTION}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!res.ok) {
      const msg = res.status === 404 ? 'Base introuvable : la partager avec la connexion « Gestion Classe » (··· → Connexions)' : `Notion ${res.status}`;
      return Response.json({ error: msg }, { status: 502, headers: CORS });
    }
    const data = await res.json();
    for (const page of (data.results ?? []) as NotionPage[]) results.push(summarize(page));
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  const filtered = query ? results.filter((r) => r.title.toLowerCase().includes(query) || r.text.toLowerCase().includes(query)) : results;
  return Response.json({ results: filtered, total: results.length }, { headers: CORS });
});
