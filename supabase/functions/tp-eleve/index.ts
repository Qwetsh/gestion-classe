import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { closedByTitle, imagePaths, isUuid, ownedPaths, publicDoc } from "../classeur-eleve/release.ts";

/**
 * Onglet TP de l'espace élève (PLAN_tp_groupes.md, lot 3) : photos du groupe et cours de
 * l'activité, sans ouvrir la base ni le stockage.
 *
 * L'élève n'a pas de compte : il présente son code à 6 chiffres (et `studentId` quand un code
 * désigne plusieurs fiches). Tout passe par get_student_tp (migration 088), qui vérifie qu'il est
 * membre d'un groupe de ce TP, absent compris, et dit quels cours le professeur a ouverts
 * (tp_templates.student_boards, écrit par son navigateur). Le serveur ne choisit rien d'après
 * un titre ; un titre devenu « (correction) » referme le cours.
 *
 * Appels (POST, JSON), avec { code, studentId?, sessionId } :
 *  - { action: "photos" }               → { urls: { idDePhoto: adresseSignée } } (groupe + toute la classe) ;
 *  - { action: "doc", boardId }         → { doc, images } d'un cours ouvert pour ce TP ;
 *  - { action: "upload", image, caption? } → { photo } : dépôt d'une photo (lot 4, migration 089).
 *    `image` = JPEG en base64, déjà réduit sur le téléphone de l'élève (1 Mo au plus : limite du
 *    bucket). Refusé si le dépôt est fermé (403 « closed ») ;
 *  - { action: "delete", photoId }      → { ok } : l'élève retire une de SES photos, dépôt ouvert.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const PHOTOS = "student-photos";
const ASSETS = "board-assets";
/** Le temps de regarder les photos et de lire la fiche pendant le TP ou à la maison. */
const SIGNED_URL_TTL = 60 * 60 * 3;
const CODE = /^\d{6}$/;

class ServerError extends Error {}
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

interface TpDetail {
  error?: string;
  docs?: { kind: string; board_id: string; title: string }[];
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
  const code = typeof body?.code === "string" ? body.code : "";
  const studentId = isUuid(body?.studentId) ? body.studentId : null;
  const sessionId = body?.sessionId;
  if (action !== "photos" && action !== "doc" && action !== "upload" && action !== "delete") return json({ error: "bad_request" }, 400);
  // Même réponse pour un accès mal formé, inconnu ou refusé : rien à apprendre de l'erreur
  if (!CODE.test(code) || !isUuid(sessionId)) return json({ error: "forbidden" }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    if (await codeBlocked(supabase, req, code)) return json({ error: "forbidden" }, 403);
    if (action === "photos") return await photos(supabase, code, studentId, sessionId);
    if (action === "doc") return await doc(supabase, code, studentId, sessionId, body.boardId);
    if (action === "upload") return await upload(supabase, code, studentId, sessionId, body.image, body.caption);
    return await remove(supabase, code, studentId, sessionId, body.photoId);
  } catch (err) {
    if (!(err instanceof ServerError)) console.error("tp-eleve", err);
    return json({ error: "server" }, 500);
  }
});

/**
 * Frein sur les essais de codes élèves (migration 094). La base ne voit que l'adresse de cette
 * fonction : on lui transmet celle du visiteur. `cf-connecting-ip` ne peut pas être falsifié ;
 * à défaut, le dernier élément de `x-forwarded-for` (le premier est écrit par le visiteur).
 * Renvoie true si l'appel doit être traité comme un code invalide.
 */
async function codeBlocked(supabase: SupabaseClient, req: Request, code: string): Promise<boolean> {
  const forwarded = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = req.headers.get("cf-connecting-ip") ?? forwarded[forwarded.length - 1] ?? "0.0.0.0";
  const { data, error } = await supabase.rpc("_student_code_gate", { p_codes: [code], p_ip: ip });
  // Base injoignable ou migration absente : on ne ferme pas l'espace élève pour autant.
  if (error) {
    console.error("student_code_gate", error.message);
    return false;
  }
  return data === true;
}

/** Plafond d'un fichier : la limite du bucket student-photos (le téléphone réduit avant d'envoyer). */
const MAX_BYTES = 1_000_000;
/** Garde-fou contre un envoi en boucle : largement assez pour un TP. */
const MAX_PHOTOS_PER_STUDENT = 30;

interface DepositTarget { student_id: string; group_id: string; owner_id: string; open: boolean; my_photos: number }

async function depositTarget(supabase: SupabaseClient, code: string, studentId: string | null, sessionId: string): Promise<DepositTarget | null> {
  const rows = must(await supabase.rpc("student_tp_deposit_target", { p_code: code, p_session_id: sessionId, p_student_id: studentId })) as DepositTarget[] | null;
  return rows?.[0] ?? null;
}

function decodeBase64(data: string): Uint8Array | null {
  try {
    const clean = data.replace(/^data:image\/jpeg;base64,/, "");
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function upload(supabase: SupabaseClient, code: string, studentId: string | null, sessionId: string, image: unknown, caption: unknown): Promise<Response> {
  if (typeof image !== "string" || image.length > MAX_BYTES * 1.4 + 64) return json({ error: "too_large" }, 413);
  const target = await depositTarget(supabase, code, studentId, sessionId);
  if (!target) return json({ error: "forbidden" }, 403);
  if (!target.open) return json({ error: "closed" }, 403);
  if (target.my_photos >= MAX_PHOTOS_PER_STUDENT) return json({ error: "too_many" }, 429);

  const bytes = decodeBase64(image);
  if (!bytes || bytes.length === 0) return json({ error: "bad_request" }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: "too_large" }, 413);
  // Un vrai JPEG (le téléphone réencode toujours en JPEG) : rien d'autre ne part dans le stockage
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return json({ error: "bad_request" }, 400);

  const id = crypto.randomUUID();
  const path = `${target.owner_id}/tp/${sessionId}/${id}.jpg`;
  const up = await supabase.storage.from(PHOTOS).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new ServerError();

  const text = typeof caption === "string" ? caption.trim().slice(0, 120) : "";
  const { data: row, error } = await supabase
    .from("group_session_photos")
    .insert({ id, session_id: sessionId, group_id: target.group_id, file_path: path, caption: text, author: "student", student_id: target.student_id })
    .select("id, created_at, caption")
    .single();
  if (error || !row) {
    await supabase.storage.from(PHOTOS).remove([path]);
    throw new ServerError();
  }
  const signed = await supabase.storage.from(PHOTOS).createSignedUrl(path, SIGNED_URL_TTL);
  return json({ photo: { id: row.id, created_at: row.created_at, caption: row.caption || null, url: signed.data?.signedUrl ?? null } });
}

async function remove(supabase: SupabaseClient, code: string, studentId: string | null, sessionId: string, photoId: unknown): Promise<Response> {
  if (!isUuid(photoId)) return json({ error: "forbidden" }, 403);
  const target = await depositTarget(supabase, code, studentId, sessionId);
  if (!target) return json({ error: "forbidden" }, 403);
  if (!target.open) return json({ error: "closed" }, 403);
  const photo = must(await supabase
    .from("group_session_photos")
    .select("id, file_path")
    .eq("id", photoId)
    .eq("session_id", sessionId)
    .eq("author", "student")
    .eq("student_id", target.student_id)
    .maybeSingle()) as { id: string; file_path: string } | null;
  // Seulement ses propres photos : celles du professeur ou des autres élèves ne se retirent pas d'ici
  if (!photo) return json({ error: "forbidden" }, 403);
  must(await supabase.from("group_session_photos").delete().eq("id", photo.id));
  await supabase.storage.from(PHOTOS).remove([photo.file_path]);
  return json({ ok: true });
}

async function photos(supabase: SupabaseClient, code: string, studentId: string | null, sessionId: string): Promise<Response> {
  const rows = must(await supabase.rpc("student_tp_photo_paths", { p_code: code, p_session_id: sessionId, p_student_id: studentId })) as
    | { id: string; file_path: string }[]
    | null;
  if (!rows || rows.length === 0) {
    // Pas de photo, ou pas membre : la fiche du TP le dit déjà, on ne distingue pas ici
    return json({ urls: {} });
  }
  const signed = must(await supabase.storage.from(PHOTOS).createSignedUrls(rows.map((r) => r.file_path), SIGNED_URL_TTL));
  const byPath = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  const urls: Record<string, string> = {};
  for (const r of rows) {
    const url = byPath.get(r.file_path);
    if (url) urls[r.id] = url;
  }
  return json({ urls });
}

async function doc(supabase: SupabaseClient, code: string, studentId: string | null, sessionId: string, boardId: unknown): Promise<Response> {
  if (!isUuid(boardId)) return json({ error: "forbidden" }, 403);
  const detail = must(await supabase.rpc("get_student_tp", { p_code: code, p_session_id: sessionId, p_student_id: studentId })) as TpDetail | null;
  if (!detail || detail.error) return json({ error: "forbidden" }, 403);
  // Le cours doit être l'un de ceux que le professeur a ouverts pour ce TP, à l'instant
  if (!(detail.docs ?? []).some((d) => d.board_id === boardId)) return json({ error: "forbidden" }, 403);

  const session = must(await supabase.from("group_sessions").select("user_id").eq("id", sessionId).maybeSingle()) as { user_id: string } | null;
  if (!session) return json({ error: "forbidden" }, 403);
  const board = must(await supabase
    .from("boards")
    .select("title, doc")
    .eq("id", boardId)
    .eq("user_id", session.user_id)
    .maybeSingle()) as { title: string; doc: unknown } | null;
  if (!board || closedByTitle(board.title ?? "", "page")) return json({ error: "forbidden" }, 403);

  const pub = publicDoc(board.doc);
  if (!pub) return json({ error: "not_found" }, 404);
  const paths = ownedPaths(imagePaths(pub.content), session.user_id);
  const images: Record<string, string> = {};
  if (paths.length > 0) {
    const signed = must(await supabase.storage.from(ASSETS).createSignedUrls(paths, SIGNED_URL_TTL));
    for (const s of signed ?? []) if (s.path && s.signedUrl) images[s.path] = s.signedUrl;
  }
  return json({ doc: pub, images });
}
