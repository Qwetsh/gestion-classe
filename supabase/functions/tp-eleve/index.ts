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
 * Deux appels (POST, JSON), avec { code, studentId?, sessionId } :
 *  - { action: "photos" }          → { urls: { idDePhoto: adresseSignée } } (groupe + toute la classe) ;
 *  - { action: "doc", boardId }    → { doc, images } d'un cours ouvert pour ce TP.
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
  if (action !== "photos" && action !== "doc") return json({ error: "bad_request" }, 400);
  // Même réponse pour un accès mal formé, inconnu ou refusé : rien à apprendre de l'erreur
  if (!CODE.test(code) || !isUuid(sessionId)) return json({ error: "forbidden" }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    return action === "photos"
      ? await photos(supabase, code, studentId, sessionId)
      : await doc(supabase, code, studentId, sessionId, body.boardId);
  } catch (err) {
    if (!(err instanceof ServerError)) console.error("tp-eleve", err);
    return json({ error: "server" }, 500);
  }
});

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
