import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeBase64, encodeBase64Url } from "jsr:@std/encoding@1";

/**
 * « Ajouter une copie » par QR code (migration 058).
 *
 * Le prof, dans « Voir les copies », crée un jeton pour un élève ; le QR code ouvre la page
 * publique /depot#<jeton> sur son téléphone, qui envoie les pages ici. La page publique n'a
 * jamais d'accès direct à Supabase : tout passe par cette fonction, qui vérifie le jeton.
 *
 * Corps { action, … } :
 *  - "create"  (JWT du prof)  { assessment_id, student_id }  → { token, expires_at, max_pages }
 *  - "revoke"  (JWT du prof)  { token }                       → { ok }
 *  - "info"    (jeton)        { token }  → pseudo, classe, éval, pages reçues / plafond, expiration
 *  - "upload"  (jeton)        { token, image (JPEG en base64) }  → { page_order, pages_uploaded }
 *
 * verify_jwt est désactivé (la page publique n'a pas de compte) : "create" et "revoke"
 * vérifient eux-mêmes le JWT du prof.
 */

const BUCKET = "assessment-copies";
const TOKEN_TTL_MS = 15 * 60_000;
const MAX_PAGES = 8;
// Limite du bucket : 5 Mo par fichier. Le navigateur réduit à 2000 px / JPEG 0,75 avant l'envoi.
const MAX_BYTES = 5 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function currentUser(sb: SupabaseClient, req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user ?? null;
}

/** Jeton encore valable (non révoqué, non expiré), ou null. */
async function liveToken(sb: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  const { data } = await sb
    .from("assessment_upload_tokens")
    .select("id, user_id, assessment_id, student_id, expires_at, max_pages, pages_uploaded, revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  switch (body.action) {
    case "create": {
      const user = await currentUser(sb, req);
      if (!user) return json({ error: "unauthorized" }, 401);
      const assessmentId = String(body.assessment_id ?? "");
      const studentId = String(body.student_id ?? "");
      if (!UUID.test(assessmentId) || !UUID.test(studentId)) return json({ error: "bad_request" }, 400);
      const [{ data: assessment }, { data: student }] = await Promise.all([
        sb.from("written_assessments").select("user_id").eq("id", assessmentId).maybeSingle(),
        sb.from("students").select("user_id").eq("id", studentId).maybeSingle(),
      ]);
      if (!assessment || assessment.user_id !== user.id || !student || student.user_id !== user.id) {
        return json({ error: "not_found" }, 404);
      }
      const token = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      const { error } = await sb.from("assessment_upload_tokens").insert({
        token_hash: await sha256(token),
        user_id: user.id,
        assessment_id: assessmentId,
        student_id: studentId,
        expires_at: expiresAt,
        max_pages: MAX_PAGES,
      });
      if (error) return json({ error: "token_failed" }, 500);
      return json({ token, expires_at: expiresAt, max_pages: MAX_PAGES });
    }

    case "revoke": {
      const user = await currentUser(sb, req);
      if (!user) return json({ error: "unauthorized" }, 401);
      if (typeof body.token !== "string" || !TOKEN.test(body.token)) return json({ error: "bad_request" }, 400);
      await sb
        .from("assessment_upload_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", await sha256(body.token))
        .eq("user_id", user.id)
        .is("revoked_at", null);
      return json({ ok: true });
    }

    case "info": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "expired" }, 410);
      const [{ data: student }, { data: assessment }] = await Promise.all([
        sb.from("students").select("pseudo").eq("id", t.student_id).maybeSingle(),
        sb.from("written_assessments").select("name, class_id").eq("id", t.assessment_id).maybeSingle(),
      ]);
      const { data: klass } = assessment?.class_id
        ? await sb.from("classes").select("name").eq("id", assessment.class_id).maybeSingle()
        : { data: null };
      return json({
        pseudo: student?.pseudo ?? "",
        class_name: klass?.name ?? "",
        assessment_name: assessment?.name ?? "",
        pages_uploaded: t.pages_uploaded,
        max_pages: t.max_pages,
        expires_at: t.expires_at,
      });
    }

    case "upload": {
      if (typeof body.token !== "string" || !TOKEN.test(body.token) || typeof body.image !== "string") {
        return json({ error: "bad_request" }, 400);
      }
      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(body.image);
      } catch {
        return json({ error: "bad_image" }, 400);
      }
      if (bytes.length > MAX_BYTES) return json({ error: "too_large" }, 413);
      if (!isJpeg(bytes)) return json({ error: "bad_image" }, 400);

      // Compte la page avant d'écrire : le plafond tient même avec des envois simultanés.
      const tokenHash = await sha256(body.token);
      const { data: claimed, error: claimError } = await sb.rpc("claim_upload_token_page", { p_token_hash: tokenHash });
      const slot = Array.isArray(claimed) ? claimed[0] : null;
      if (claimError || !slot) return json({ error: "expired_or_full" }, 410);

      const release = () =>
        sb.from("assessment_upload_tokens")
          .update({ pages_uploaded: slot.page_number - 1 })
          .eq("token_hash", tokenHash)
          .eq("pages_uploaded", slot.page_number);

      const pageId = crypto.randomUUID();
      const path = `${slot.user_id}/${slot.assessment_id}/${slot.student_id}/${pageId}.jpg`;
      const { error: upError } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
      if (upError) {
        await release();
        return json({ error: "storage_failed" }, 500);
      }

      // Après les pages existantes ; un numéro pris entre-temps (autre envoi) → on recommence.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: last } = await sb
          .from("assessment_copy_pages")
          .select("page_order")
          .eq("assessment_id", slot.assessment_id)
          .eq("student_id", slot.student_id)
          .order("page_order", { ascending: false })
          .limit(1);
        const pageOrder = ((last?.[0]?.page_order as number | undefined) ?? 0) + 1;
        const { error } = await sb.from("assessment_copy_pages").insert({
          id: pageId,
          user_id: slot.user_id,
          assessment_id: slot.assessment_id,
          student_id: slot.student_id,
          page_order: pageOrder,
          storage_path: path,
        });
        if (!error) return json({ page_order: pageOrder, pages_uploaded: slot.page_number });
        if (error.code !== "23505") break;
      }
      await sb.storage.from(BUCKET).remove([path]);
      await release();
      return json({ error: "page_failed" }, 500);
    }

    default:
      return json({ error: "bad_request" }, 400);
  }
});
