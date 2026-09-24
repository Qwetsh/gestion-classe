import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sert le sujet ou le corrigé d'une évaluation à un élève, sans ouvrir le bucket.
 *
 * `assessment-docs` est privé et ses policies sont écrites pour l'enseignant
 * (`auth.uid() = user_id`). Un élève, lui, n'est pas authentifié : il présente un code à
 * 6 chiffres. On ne peut donc ni lui appliquer les RLS, ni rendre le bucket public —
 * un corrigé accessible à qui devine une URL n'est pas acceptable.
 *
 * Cette fonction tranche : elle valide le code côté serveur, vérifie les deux verrous
 * (onglet Notes actif pour la classe, évaluation publiée), et ne rend qu'une URL signée
 * de courte durée. La clé de service ne quitte jamais le serveur.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const BUCKET = "assessment-docs";
/** Durée de vie de l'URL signée : le temps d'ouvrir le PDF, pas de le partager. */
const SIGNED_URL_TTL = 120;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let code: string, assessmentId: string, kind: string;
  try {
    const body = await req.json();
    code = String(body.code ?? "");
    assessmentId = String(body.assessmentId ?? "");
    kind = String(body.kind ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code" }, 403);
  if (kind !== "subject" && kind !== "correction") return json({ error: "bad_request" }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) return json({ error: "bad_request" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1. Le code identifie un élève, et donc une classe.
  const { data: student } = await supabase
    .from("students")
    .select("id, class_id, is_witness")
    .eq("student_code", code)
    .maybeSingle();
  if (!student?.class_id) return json({ error: "invalid_code" }, 403);

  // 2. Premier verrou : l'onglet Notes est-il ouvert à cette classe ?
  const { data: tabs } = await supabase
    .from("class_student_tabs")
    .select("show_grades")
    .eq("class_id", student.class_id)
    .maybeSingle();
  if (!tabs?.show_grades && !student.is_witness) return json({ error: "forbidden" }, 403);

  // 3. Second verrou : l'évaluation appartient bien à sa classe, et elle est publiée.
  const { data: assessment } = await supabase
    .from("written_assessments")
    .select("id, subject_path, correction_path, series_id, assessment_series(subject_path, correction_path)")
    .eq("id", assessmentId)
    .eq("class_id", student.class_id)
    .eq("is_deleted", false)
    .eq("published_to_students", true)
    .maybeSingle();
  if (!assessment) return json({ error: "forbidden" }, 403);

  // Le document peut être porté par l'évaluation ou, s'il est commun, par sa série.
  const series = assessment.assessment_series as
    | { subject_path: string | null; correction_path: string | null }
    | null;
  const path = kind === "subject"
    ? (assessment.subject_path ?? series?.subject_path ?? null)
    : (assessment.correction_path ?? series?.correction_path ?? null);
  if (!path) return json({ error: "not_found" }, 404);

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !signed?.signedUrl) return json({ error: "sign_failed" }, 500);

  return json({ url: signed.signedUrl });
});
