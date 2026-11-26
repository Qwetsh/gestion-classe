import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { imagePaths, isUuid, ownedPaths } from "../classeur-eleve/release.ts";
import { MOBILE_TOKEN, linkEligible, mobileDoc, type LinkKind } from "./rules.ts";

/**
 * Sert la version couleur au format téléphone d'un document imprimé, à qui scanne son QR code.
 *
 * Les cours (`boards`) et leurs images (bucket `board-assets`) sont privés : leurs politiques sont
 * écrites pour le professeur. Qui scanne n'a pas de compte : il arrive par le jeton du QR code
 * (table `board_mobile_links`, migration 090, créé par le navigateur du professeur à la première
 * impression). Cette fonction tranche avec la clé de service, qui ne quitte jamais le serveur.
 *
 * Le document est lu à chaque appel : la page du téléphone suit les modifications du cours. Le
 * titre est relu aussi : une correction ou une évaluation n'est jamais servie (rules.ts), même si
 * un jeton existe pour elle.
 *
 * Lien de partage (table `board_share_links`, migration 092) : le lien que le professeur colle
 * dans le cahier de texte. Même page, même lecture ; il peut aussi ouvrir une correction
 * d'activité (jamais une évaluation : rules.ts, shareEligible), et garde les zones d'écriture
 * pour que la fiche s'imprime telle qu'elle est distribuée.
 *
 * Un appel (POST, JSON) : { token } → { title, kind, doc, images } : le texte du cours, la sorte de
 * lien (« qr » ou « share ») et les adresses signées de ses images. Même refus (403) pour un jeton mal formé, inconnu, coupé, ou un cours qui
 * ne peut pas sortir : rien à apprendre de l'erreur.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const BUCKET = "board-assets";
/** Durée de vie des adresses d'images : le temps de lire le document (la page se relit au-delà). */
const SIGNED_URL_TTL = 60 * 60 * 6;

/** Panne de la base ou du stockage : à ne pas confondre avec un refus (on lirait « ce lien ne fonctionne plus »). */
class ServerError extends Error {}
/** Résultat d'une requête, ou une erreur de serveur si elle a échoué. */
function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw new ServerError();
  return res.data;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const token = typeof body?.token === "string" ? body.token : null;
  if (token === null || !MOBILE_TOKEN.test(token)) return json({ error: "forbidden" }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    return await answer(supabase, token);
  } catch (err) {
    // Toute panne répond en 500 avec ses en-têtes (sans eux, le navigateur dirait « pas de connexion »)
    if (!(err instanceof ServerError)) console.error("version-mobile", err);
    return json({ error: "server" }, 500);
  }
});

/** Table absente (migration pas encore appliquée) : pas de lien de cette sorte, ce n'est pas une panne. */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));
}

type Link = { board_id: unknown; user_id: unknown; kind: LinkKind };

/** Le lien de ce jeton : QR code imprimé (090), sinon lien de partage (092). */
async function findLink(supabase: SupabaseClient, token: string): Promise<Link | null> {
  const qr = must(await supabase
    .from("board_mobile_links")
    .select("board_id, user_id")
    .eq("token", token)
    .maybeSingle());
  if (qr) return { ...qr, kind: "qr" };
  const share = await supabase
    .from("board_share_links")
    .select("board_id, user_id")
    .eq("token", token)
    .maybeSingle();
  if (share.error) {
    if (isMissingTable(share.error)) return null;
    throw new ServerError();
  }
  return share.data ? { ...share.data, kind: "share" } : null;
}

async function answer(supabase: SupabaseClient, token: string): Promise<Response> {
  const link = await findLink(supabase, token);
  if (!link || !isUuid(link.board_id) || !isUuid(link.user_id)) return json({ error: "forbidden" }, 403);

  // Le lien doit avoir été créé par le propriétaire du cours
  const board = must(await supabase
    .from("boards")
    .select("title, doc")
    .eq("id", link.board_id)
    .eq("user_id", link.user_id)
    .maybeSingle());
  if (!board) return json({ error: "forbidden" }, 403);
  const title = typeof board.title === "string" ? board.title : "";
  // Une évaluation ne sort jamais, une correction seulement par un lien de partage, même par un jeton existant
  if (!linkEligible(link.kind, title)) return json({ error: "forbidden" }, 403);

  const doc = mobileDoc(board.doc, link.kind);
  if (!doc) return json({ error: "not_found" }, 404);

  const paths = ownedPaths(imagePaths(doc.content), link.user_id);
  const images: Record<string, string> = {};
  if (paths.length > 0) {
    const signed = must(await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL));
    for (const s of signed ?? []) if (s.path && s.signedUrl) images[s.path] = s.signedUrl;
  }
  return json({ title, kind: link.kind, doc, images });
}
