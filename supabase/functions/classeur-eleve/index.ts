import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { boardIds, imagePaths, isUuid, openItems, ownedItems, ownedPaths, publicDoc, type ItemRow, type OpenItem } from "./release.ts";

/**
 * Sert le classeur virtuel à une classe, sans ouvrir la base ni le stockage.
 *
 * Les cours (`boards`) et leurs images (bucket `board-assets`) sont privés : leurs politiques sont
 * écrites pour le professeur. Un élève n'a pas de compte. Il arrive par le lien de sa classe (jeton
 * long et aléatoire, table `class_binders`), ou par son code à 6 chiffres depuis l'espace élève
 * (si le professeur a ouvert l'onglet « Classeur » à sa classe ; l'élève témoin le voit toujours).
 * Cette fonction tranche avec la clé de service, qui ne quitte jamais le serveur.
 *
 * Elle ne décide de rien par elle-même : elle suit les lignes `class_binder_items` de la classe,
 * écrites par le professeur quand il a ouvert une activité (voir release.ts). Fermé par défaut.
 *
 * Deux appels (POST, JSON) :
 *  - { action: "toc", token }            → le nom de la classe et les éléments ouverts ;
 *  - { action: "doc", token, boardId }   → le texte d'un cours ouvert et les adresses signées de
 *                                           ses images. Revérifié à chaque appel.
 * À la place de `token` : { code, studentId? } (espace élève).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const BUCKET = "board-assets";
/** Durée de vie des adresses d'images : le temps de lire le classeur (comme pour le professeur). */
const SIGNED_URL_TTL = 60 * 60 * 6;
const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
const CODE = /^\d{6}$/;

/** Panne de la base ou du stockage : à ne pas confondre avec un refus (l'élève lirait « ce lien ne fonctionne plus »). */
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

interface BinderClass { id: string; name: string; user_id: string }

/** La classe désignée par le jeton, si son lien est actif. */
async function classOfToken(supabase: SupabaseClient, token: string): Promise<BinderClass | null> {
  const binder = must(await supabase
    .from("class_binders")
    .select("class_id, user_id")
    .eq("link_token", token)
    .eq("link_enabled", true)
    .maybeSingle());
  if (!binder) return null;
  const cls = must(await supabase
    .from("classes")
    .select("id, name, user_id")
    .eq("id", binder.class_id)
    .not("is_deleted", "is", true)
    .maybeSingle());
  // L'accès doit avoir été réglé par le professeur de la classe
  if (!cls || cls.user_id !== binder.user_id) return null;
  return cls as BinderClass;
}

/**
 * La classe de l'élève désigné par le code, si l'onglet « Classeur » lui est ouvert. Le code est
 * résolu comme partout dans l'espace élève (`resolve_student_code` : un code peut désigner plusieurs
 * fiches, `studentId` choisit). L'élève témoin du professeur voit l'onglet même fermé (aperçu).
 */
async function classOfCode(supabase: SupabaseClient, code: string, studentId: string | null): Promise<BinderClass | null> {
  const resolved = must(await supabase.rpc("resolve_student_code", { p_code: code, p_student_id: studentId }));
  if (!isUuid(resolved)) return null;
  const student = must(await supabase
    .from("students")
    .select("id, class_id, user_id, is_witness, is_deleted")
    .eq("id", resolved)
    .maybeSingle());
  if (!student?.class_id || student.is_deleted === true) return null;
  const cls = must(await supabase
    .from("classes")
    .select("id, name, user_id")
    .eq("id", student.class_id)
    .not("is_deleted", "is", true)
    .maybeSingle());
  if (!cls || cls.user_id !== student.user_id) return null;
  if (student.is_witness !== true) {
    const binder = must(await supabase
      .from("class_binders")
      .select("user_id, tab_enabled")
      .eq("class_id", cls.id)
      .maybeSingle());
    if (!binder || binder.tab_enabled !== true || binder.user_id !== cls.user_id) return null;
  }
  return cls as BinderClass;
}

/** Éléments ouverts à la classe, resserrés aux cours de son professeur, avec les cours cités. */
async function openFor(supabase: SupabaseClient, cls: BinderClass): Promise<{ items: OpenItem[]; boards: { id: string; title: string; updated_at: string }[] }> {
  const rows = must(await supabase
    .from("class_binder_items")
    .select("anchor_board_id, visible, correction_visible, released")
    .eq("class_id", cls.id)
    .eq("user_id", cls.user_id)
    .eq("visible", true));
  const items = openItems((rows ?? []) as ItemRow[]);
  const ids = boardIds(items);
  if (ids.length === 0) return { items: [], boards: [] };
  // Par paquets : une liste d'identifiants trop longue ne passerait pas dans une adresse
  const owned: { id: string; title: string; updated_at: string }[] = [];
  for (let from = 0; from < ids.length; from += 100) {
    const part = must(await supabase
      .from("boards")
      .select("id, title, updated_at")
      .in("id", ids.slice(from, from + 100))
      .eq("user_id", cls.user_id));
    owned.push(...((part ?? []) as typeof owned));
  }
  // Le titre d'aujourd'hui ne sert qu'à refermer un cours devenu correction ou évaluation
  const kept = ownedItems(items, new Map(owned.map((b) => [b.id, b.title])));
  const cited = new Set(boardIds(kept));
  // Le titre d'une copie modèle ne sort pas : seul celui d'une page se lit dans le classeur
  const pages = new Set(kept.flatMap((i) => i.released.pages.map((p) => p.board)));
  return { items: kept, boards: owned.filter((b) => cited.has(b.id)).map((b) => (pages.has(b.id) ? b : { ...b, title: "" })) };
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
  const action = body?.action;
  const token = typeof body?.token === "string" ? body.token : null;
  const code = typeof body?.code === "string" ? body.code : null;
  const studentId = isUuid(body?.studentId) ? body.studentId : null;
  if (action !== "toc" && action !== "doc") return json({ error: "bad_request" }, 400);
  // Même réponse pour un accès mal formé, inconnu, coupé ou fermé : rien à apprendre de l'erreur
  if (token !== null ? !TOKEN.test(token) : code === null || !CODE.test(code)) return json({ error: "forbidden" }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    return await answer(supabase, action, token, code, studentId, body.boardId);
  } catch (err) {
    if (err instanceof ServerError) return json({ error: "server" }, 500);
    throw err;
  }
});

async function answer(supabase: SupabaseClient, action: "toc" | "doc", token: string | null, code: string | null, studentId: string | null, boardId: unknown): Promise<Response> {
  const cls = token !== null ? await classOfToken(supabase, token) : await classOfCode(supabase, code!, studentId);
  if (!cls) return json({ error: "forbidden" }, 403);

  const { items, boards } = await openFor(supabase, cls);

  if (action === "toc") {
    return json({ className: cls.name, items, boards });
  }

  // action === "doc" : le cours doit être cité par un élément ouvert, à l'instant
  if (!isUuid(boardId) || !boards.some((b) => b.id === boardId)) return json({ error: "forbidden" }, 403);
  const board = must(await supabase
    .from("boards")
    .select("doc")
    .eq("id", boardId)
    .eq("user_id", cls.user_id)
    .maybeSingle());
  const doc = publicDoc(board?.doc);
  if (!doc) return json({ error: "not_found" }, 404);

  const paths = ownedPaths(imagePaths(doc.content), cls.user_id);
  const images: Record<string, string> = {};
  if (paths.length > 0) {
    const signed = must(await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL));
    for (const s of signed ?? []) if (s.path && s.signedUrl) images[s.path] = s.signedUrl;
  }
  return json({ doc, images });
}
