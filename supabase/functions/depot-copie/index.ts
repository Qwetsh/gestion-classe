import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeBase64, encodeBase64Url } from "jsr:@std/encoding@1";

/**
 * « Ajouter une copie » par QR code (migration 058).
 *
 * Le prof, dans « Voir les copies », crée un jeton pour un élève, ou pour toute l'éval
 * (migration 060, « Ajouter les copies de la classe ») ; le QR code ouvre la page publique
 * /depot#<jeton> sur son téléphone, qui envoie les pages ici. La page publique n'a jamais
 * d'accès direct à Supabase : tout passe par cette fonction, qui vérifie le jeton.
 *
 * Corps { action, … } :
 *  - "create"  (JWT du prof)  { assessment_id, student_id? }  → { token, expires_at, max_pages, mode }
 *      sans student_id : jeton de classe (60 min, 200 pages), sinon un élève (15 min, 8 pages)
 *  - "revoke"  (JWT du prof)  { token }                       → { ok }
 *  - "info"    (jeton)        { token }  → classe, éval, pages reçues / plafond, expiration ;
 *      jeton d'élève : son pseudo ; jeton de classe : les élèves attendus (pseudo, pages déjà
 *      rangées) et le nombre de copies sans nom
 *  - "upload"  (jeton)        { token, image (JPEG en base64) }  → { page_order, pages_uploaded }
 *      jeton de classe : en plus { student_id } (un élève attendu de l'éval) ou { unnamed: true,
 *      copy_id? } (copie « Pas de nom » ; sans copy_id, nouvelle copie) → + { copy_id }
 *
 * verify_jwt est désactivé (la page publique n'a pas de compte) : "create" et "revoke"
 * vérifient eux-mêmes le JWT du prof.
 */

const BUCKET = "assessment-copies";
const TOKEN_TTL_MS = 15 * 60_000;
const MAX_PAGES = 8;
// Jeton de classe : le paquet entier, élève après élève.
const CLASS_TOKEN_TTL_MS = 60 * 60_000;
const CLASS_MAX_PAGES = 200;
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

/**
 * Élèves attendus de l'éval (comme fetchExpectedStudents côté web) : la classe, ou le
 * demi-groupe de l'éval ; ni élève témoin, ni élève supprimé.
 */
async function expectedStudents(sb: SupabaseClient, userId: string, assessmentId: string) {
  const { data: assessment } = await sb
    .from("written_assessments")
    .select("class_id, group_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!assessment?.class_id) return [];
  const { data: students } = await sb
    .from("students")
    .select("id, pseudo")
    .eq("user_id", userId)
    .eq("class_id", assessment.class_id)
    .eq("is_deleted", false)
    .eq("is_witness", false)
    .order("pseudo");
  if (!assessment.group_id) return students ?? [];
  const { data: members } = await sb
    .from("class_group_members")
    .select("student_id")
    .eq("group_id", assessment.group_id);
  const keep = new Set((members ?? []).map((m) => m.student_id as string));
  return (students ?? []).filter((s) => keep.has(s.id as string));
}

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
      // Sans élève : jeton de classe (migration 060).
      const studentId = body.student_id == null || body.student_id === "" ? null : String(body.student_id);
      if (!UUID.test(assessmentId) || (studentId !== null && !UUID.test(studentId))) {
        return json({ error: "bad_request" }, 400);
      }
      const [{ data: assessment }, { data: student }] = await Promise.all([
        sb.from("written_assessments").select("user_id").eq("id", assessmentId).maybeSingle(),
        studentId
          ? sb.from("students").select("user_id").eq("id", studentId).maybeSingle()
          : Promise.resolve({ data: { user_id: user.id } }),
      ]);
      if (!assessment || assessment.user_id !== user.id || !student || student.user_id !== user.id) {
        return json({ error: "not_found" }, 404);
      }
      const isClass = studentId === null;
      const maxPages = isClass ? CLASS_MAX_PAGES : MAX_PAGES;
      const token = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const expiresAt = new Date(Date.now() + (isClass ? CLASS_TOKEN_TTL_MS : TOKEN_TTL_MS)).toISOString();
      const { error } = await sb.from("assessment_upload_tokens").insert({
        token_hash: await sha256(token),
        user_id: user.id,
        assessment_id: assessmentId,
        student_id: studentId,
        expires_at: expiresAt,
        max_pages: maxPages,
      });
      if (error) return json({ error: "token_failed" }, 500);
      return json({ token, expires_at: expiresAt, max_pages: maxPages, mode: isClass ? "class" : "student" });
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
        t.student_id
          ? sb.from("students").select("pseudo").eq("id", t.student_id).maybeSingle()
          : Promise.resolve({ data: null }),
        sb.from("written_assessments").select("name, class_id").eq("id", t.assessment_id).maybeSingle(),
      ]);
      const { data: klass } = assessment?.class_id
        ? await sb.from("classes").select("name").eq("id", assessment.class_id).maybeSingle()
        : { data: null };
      const base = {
        class_name: klass?.name ?? "",
        assessment_name: assessment?.name ?? "",
        pages_uploaded: t.pages_uploaded,
        max_pages: t.max_pages,
        expires_at: t.expires_at,
      };
      if (t.student_id) return json({ mode: "student", pseudo: student?.pseudo ?? "", ...base });

      // Jeton de classe : la liste des élèves, avec les pages déjà rangées.
      const [roster, { data: pages }, { data: unnamed }] = await Promise.all([
        expectedStudents(sb, t.user_id, t.assessment_id),
        sb.from("assessment_copy_pages").select("student_id").eq("assessment_id", t.assessment_id),
        sb.from("assessment_unnamed_pages").select("copy_id").eq("assessment_id", t.assessment_id),
      ]);
      const count = new Map<string, number>();
      for (const p of pages ?? []) count.set(p.student_id as string, (count.get(p.student_id as string) ?? 0) + 1);
      return json({
        mode: "class",
        pseudo: "",
        ...base,
        students: roster.map((s) => ({ id: s.id, pseudo: s.pseudo, pages: count.get(s.id as string) ?? 0 })),
        unnamed_copies: new Set((unnamed ?? []).map((u) => u.copy_id as string)).size,
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

      // Jeton de classe : la page dit à qui elle va, vérifié avant de compter la page.
      const live = await liveToken(sb, body.token);
      if (!live) return json({ error: "expired_or_full" }, 410);
      let target: { studentId: string } | { copyId: string } | null = null;
      if (!live.student_id) {
        if (body.unnamed === true) {
          const copyId = body.copy_id == null ? crypto.randomUUID() : String(body.copy_id);
          if (!UUID.test(copyId)) return json({ error: "bad_request" }, 400);
          if (body.copy_id != null) {
            const { data: same } = await sb
              .from("assessment_unnamed_pages")
              .select("id")
              .eq("copy_id", copyId)
              .eq("assessment_id", live.assessment_id)
              .limit(1);
            if (!same?.length) return json({ error: "bad_copy" }, 400);
          }
          target = { copyId };
        } else {
          const studentId = String(body.student_id ?? "");
          if (!UUID.test(studentId)) return json({ error: "bad_request" }, 400);
          const roster = await expectedStudents(sb, live.user_id, live.assessment_id);
          if (!roster.some((s) => s.id === studentId)) return json({ error: "bad_student" }, 400);
          target = { studentId };
        }
      }

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
      const studentId = target && "studentId" in target ? target.studentId : (slot.student_id as string | null);
      const copyId = target && "copyId" in target ? target.copyId : null;
      const path = copyId
        ? `${slot.user_id}/${slot.assessment_id}/sans-nom/${pageId}.jpg`
        : `${slot.user_id}/${slot.assessment_id}/${studentId}/${pageId}.jpg`;
      const { error: upError } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
      if (upError) {
        await release();
        return json({ error: "storage_failed" }, 500);
      }

      // Après les pages existantes ; un numéro pris entre-temps (autre envoi) → on recommence.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: last } = copyId
          ? await sb
            .from("assessment_unnamed_pages")
            .select("page_order")
            .eq("copy_id", copyId)
            .order("page_order", { ascending: false })
            .limit(1)
          : await sb
            .from("assessment_copy_pages")
            .select("page_order")
            .eq("assessment_id", slot.assessment_id)
            .eq("student_id", studentId)
            .order("page_order", { ascending: false })
            .limit(1);
        const pageOrder = ((last?.[0]?.page_order as number | undefined) ?? 0) + 1;
        const row = {
          id: pageId,
          user_id: slot.user_id,
          assessment_id: slot.assessment_id,
          page_order: pageOrder,
          storage_path: path,
        };
        const { error } = copyId
          ? await sb.from("assessment_unnamed_pages").insert({ ...row, copy_id: copyId })
          : await sb.from("assessment_copy_pages").insert({ ...row, student_id: studentId });
        if (!error) {
          return json({ page_order: pageOrder, pages_uploaded: slot.page_number, ...(copyId ? { copy_id: copyId } : {}) });
        }
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
