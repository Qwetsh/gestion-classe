import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import {
  buildGrade,
  buildOutputSchema,
  estimateCostUsd,
  formatKitBlock,
  formatReference,
  formatTask,
  pickKit,
  pickReferences,
  validateOutput,
  type CorrectionKit,
  type CorrectionOutput,
  type ReferenceCandidate,
  type TranscriptItem,
  type UsageTotals,
} from "./correction.ts";

/**
 * Bouton « Corriger » / « Recorriger » de « Voir les copies » (migration 057).
 *
 * Corrige UNE copie scannée avec Claude Opus 5.5, comme le reste de la classe l'a été dans le
 * Correcteur : consignes du kit en prompt système ; barème, corrigé, calibrage et harmonisation
 * dans un bloc mis en cache ; 5 copies de référence de la même éval ; les pages de l'élève.
 * La note part en BROUILLON (Thomas valide), la transcription dans assessment_copy_transcripts,
 * les points « à arbitrer », le coût et les tokens dans assessment_ai_corrections.
 *
 * Kit : celui de la version du sujet de l'élève (assessment_grades.subject_version, migration
 * 059) ; si on ne peut pas savoir lequel prendre, refus (409) plutôt qu'un mauvais barème.
 *
 * Corps : { assessment_id, student_id, mode: "corriger" | "recorriger", confirm_validated? }.
 * Auth : JWT du prof propriétaire de l'éval. Réponse immédiate 202 { run_id } : la correction
 * tourne en tâche de fond (EdgeRuntime.waitUntil) et l'interface suit la ligne du journal.
 * Clé : secret ANTHROPIC_API_KEY (`supabase secrets set`), jamais dans le dépôt.
 */

const MODEL = "claude-opus-5-5";
const BUCKET = "assessment-copies";
const MAX_ATTEMPTS = 2;
// Un deuxième appel n'est tenté que s'il a le temps de finir avant la limite d'exécution.
const RETRY_DEADLINE_MS = 60_000;
const RUNNING_STALE_MS = 10 * 60_000;

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

interface Job {
  runId: string;
  userId: string;
  assessmentId: string;
  studentId: string;
  prenom: string;
  studentVersion: string | null;
  kit: CorrectionKit;
  pages: { storage_path: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await sb.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const assessmentId = String(body.assessment_id ?? "");
  const studentId = String(body.student_id ?? "");
  const mode = body.mode;
  if (!UUID.test(assessmentId) || !UUID.test(studentId) || (mode !== "corriger" && mode !== "recorriger")) {
    return json({ error: "bad_request" }, 400);
  }

  const { data: assessment } = await sb
    .from("written_assessments")
    .select("id, user_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!assessment || assessment.user_id !== user.id) return json({ error: "not_found" }, 404);

  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "no_api_key" }, 503);

  const { data: pages } = await sb
    .from("assessment_copy_pages")
    .select("storage_path, page_order")
    .eq("assessment_id", assessmentId)
    .eq("student_id", studentId)
    .order("page_order");
  if (!pages || pages.length === 0) return json({ error: "no_pages" }, 409);

  const { data: grade } = await sb
    .from("assessment_grades")
    .select("grade, is_validated, subject_version")
    .eq("assessment_id", assessmentId)
    .eq("student_id", studentId)
    .maybeSingle();

  // Le kit de la version du sujet de l'élève (un par version, migration 059).
  const [{ data: kitRows }, { data: others }] = await Promise.all([
    sb.from("assessment_correction_kits").select("kit, version_key").eq("assessment_id", assessmentId),
    sb.from("assessment_grades")
      .select("subject_version")
      .eq("assessment_id", assessmentId)
      .neq("student_id", studentId)
      .not("subject_version", "is", null),
  ]);
  const studentVersion = (grade?.subject_version as string | null | undefined) ?? null;
  const choice = pickKit(
    (kitRows ?? []) as { kit: CorrectionKit; version_key: string }[],
    studentVersion,
    (others ?? []).map((o) => o.subject_version as string | null),
  );
  if (!choice.ok) {
    return json({ error: choice.error, versions: choice.versions, student_version: studentVersion }, 409);
  }
  const kit = choice.kit.kit;
  const graded = grade?.grade !== null && grade?.grade !== undefined;
  if (mode === "corriger" && graded) return json({ error: "already_graded" }, 409);
  if (mode === "recorriger" && !graded) return json({ error: "not_graded" }, 409);
  // Une recorrection retire la validation : l'interface doit l'avoir fait confirmer.
  if (mode === "recorriger" && grade?.is_validated && body.confirm_validated !== true) {
    return json({ error: "needs_confirmation" }, 409);
  }

  const { data: running } = await sb
    .from("assessment_ai_corrections")
    .select("id")
    .eq("assessment_id", assessmentId)
    .eq("student_id", studentId)
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - RUNNING_STALE_MS).toISOString())
    .limit(1);
  if (running && running.length > 0) return json({ error: "already_running", run_id: running[0].id }, 409);

  const { data: student } = await sb.from("students").select("pseudo").eq("id", studentId).maybeSingle();
  // Pseudo « Prénom + 2 lettres » : seul le prénom part, pour le commentaire général.
  const prenom = String(student?.pseudo ?? "").trim().split(/\s+/)[0] ?? "";

  const { data: run, error: runError } = await sb
    .from("assessment_ai_corrections")
    .insert({ assessment_id: assessmentId, student_id: studentId, user_id: user.id, mode, model: MODEL })
    .select("id")
    .single();
  if (runError || !run) return json({ error: "journal_failed" }, 500);

  const job: Job = { runId: run.id, userId: user.id, assessmentId, studentId, prenom, studentVersion, kit, pages };
  const work = correct(sb, job).catch(async (e) => {
    console.error("corriger-copie", job.runId, e);
    await finish(sb, job.runId, { status: "error", error: describeError(e) });
  });
  // @ts-ignore EdgeRuntime est fourni par le runtime Supabase.
  EdgeRuntime.waitUntil(work);

  return json({ run_id: run.id }, 202);
});

function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Clé API Anthropic refusée (secret ANTHROPIC_API_KEY).";
  if (e instanceof Anthropic.PermissionDeniedError) return "Clé API sans accès à ce modèle.";
  if (e instanceof Anthropic.RateLimitError) return "Limite de l'API atteinte (crédits ou débit) : réessaie plus tard.";
  if (e instanceof Anthropic.APIError) return `Erreur de l'API Claude (${e.status ?? "?"}) : ${e.message}`.slice(0, 500);
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

async function finish(sb: SupabaseClient, runId: string, fields: Record<string, unknown>) {
  await sb.from("assessment_ai_corrections").update({ ...fields, finished_at: new Date().toISOString() }).eq("id", runId);
}

async function loadReferences(sb: SupabaseClient, job: Job): Promise<ReferenceCandidate[]> {
  const { data: grades } = await sb
    .from("assessment_grades")
    .select("student_id, grade, is_validated, details, subject_version")
    .eq("assessment_id", job.assessmentId)
    .eq("status", "noted")
    .neq("student_id", job.studentId)
    .not("grade", "is", null)
    .not("details", "is", null);
  const { data: transcripts } = await sb
    .from("assessment_copy_transcripts")
    .select("student_id, transcript")
    .eq("assessment_id", job.assessmentId);
  const byStudent = new Map<string, TranscriptItem[]>();
  for (const t of transcripts ?? []) {
    const items = (t.transcript as { items?: TranscriptItem[] })?.items;
    if (Array.isArray(items)) byStudent.set(t.student_id, items);
  }
  const candidates = (grades ?? []).map((g) => ({
    student_id: g.student_id,
    grade: Number(g.grade),
    is_validated: g.is_validated === true,
    details: g.details,
    transcript: byStudent.get(g.student_id) ?? null,
    subject_version: g.subject_version as string | null,
  }));
  return pickReferences(candidates, job.kit, job.studentId, 5, job.studentVersion);
}

async function loadPage(sb: SupabaseClient, path: string): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Page introuvable dans le stockage : ${path}`);
  const type = data.type || "";
  const media_type = (["image/png", "image/webp", "image/gif"].includes(type) ? type : "image/jpeg") as
    "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  return { type: "image", source: { type: "base64", media_type, data: encodeBase64(new Uint8Array(await data.arrayBuffer())) } };
}

async function correct(sb: SupabaseClient, job: Job) {
  const started = Date.now();
  const questions = job.kit.bareme.questions;
  const refs = await loadReferences(sb, job);
  const images = await Promise.all(job.pages.map((p) => loadPage(sb, p.storage_path)));

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    // Stable pour toute la classe : mis en cache quand on corrige plusieurs copies d'affilée.
    { type: "text", text: formatKitBlock(job.kit), cache_control: { type: "ephemeral" } },
  ];
  if (refs.length > 0) {
    content.push({
      type: "text",
      text: ["# Copies de référence (même évaluation, déjà corrigées)", ...refs.map(formatReference)].join("\n\n"),
      cache_control: { type: "ephemeral" },
    });
  }
  images.forEach((img, i) => {
    content.push({ type: "text", text: `Page ${i + 1} :` }, img);
  });
  content.push({ type: "text", text: formatTask(job.prenom, images.length, questions.length) });

  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), maxRetries: 1 });
  const usage: UsageTotals = { input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0 };
  let model = MODEL;
  let attempts = 0;
  let output: CorrectionOutput | null = null;
  let lastProblem = "";

  while (attempts < MAX_ATTEMPTS && !output) {
    if (attempts > 0 && Date.now() - started > RETRY_DEADLINE_MS) break;
    attempts++;
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: buildOutputSchema(questions) } },
      system: job.kit.consignes,
      messages: [{ role: "user", content }],
    });
    const msg = await stream.finalMessage();
    model = msg.model;
    usage.input_tokens += msg.usage.input_tokens ?? 0;
    usage.output_tokens += msg.usage.output_tokens ?? 0;
    usage.cache_creation_tokens += msg.usage.cache_creation_input_tokens ?? 0;
    usage.cache_read_tokens += msg.usage.cache_read_input_tokens ?? 0;

    if (msg.stop_reason === "refusal") {
      // Le repli serveur a déjà été tenté : la chaîne entière a refusé. Rien n'est écrit.
      lastProblem = `Claude a refusé de corriger cette copie${msg.stop_details?.category ? ` (${msg.stop_details.category})` : ""}.`;
      break;
    }
    if (msg.stop_reason === "max_tokens") {
      lastProblem = "Réponse coupée (trop longue).";
      continue;
    }
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      lastProblem = "Réponse illisible (JSON invalide).";
      continue;
    }
    const checked = validateOutput(parsed, questions);
    if (checked.ok) output = checked.value;
    else lastProblem = `Correction invalide : ${checked.errors.slice(0, 5).join(" ; ")}`;
  }

  const journal = {
    model,
    attempts,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_tokens: usage.cache_creation_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cost_usd: estimateCostUsd(usage),
  };
  if (!output) {
    await finish(sb, job.runId, { ...journal, status: "error", error: lastProblem || "Correction impossible." });
    return;
  }

  const g = buildGrade(job.kit, output);
  const { error: gradeError } = await sb.from("assessment_grades").upsert(
    {
      user_id: job.userId,
      assessment_id: job.assessmentId,
      student_id: job.studentId,
      grade: g.grade,
      grade_raw: g.grade_raw,
      comment: g.comment,
      details: g.details,
      status: "noted",
      is_validated: false,
      validated_at: null,
    },
    { onConflict: "assessment_id,student_id" },
  );
  if (gradeError) throw new Error(`Note non enregistrée : ${gradeError.message}`);

  const { error: trError } = await sb.from("assessment_copy_transcripts").upsert(
    {
      user_id: job.userId,
      assessment_id: job.assessmentId,
      student_id: job.studentId,
      transcript: { v: 1, items: output.transcription },
    },
    { onConflict: "assessment_id,student_id" },
  );

  await finish(sb, job.runId, {
    ...journal,
    status: "done",
    grade: g.grade,
    a_arbitrer: output.a_arbitrer,
    error: trError ? `Note enregistrée, transcription non enregistrée : ${trError.message}` : null,
  });
}
