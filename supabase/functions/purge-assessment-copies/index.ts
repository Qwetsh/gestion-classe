import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Supprime les scans de copies arrivés à échéance (migration 054, lot 4 de PLAN_copies_evaluation.md).
 *
 * Appelée chaque nuit par pg_cron (job `purge-assessment-copies`). Pour chaque éval dont
 * `copies_purge_at` est passée et qui n'a pas encore été purgée : supprime les fichiers du
 * bucket privé `assessment-copies` (ceux indexés en base ET tout ce qui reste sous le dossier
 * de l'éval — un envoi interrompu peut laisser un fichier sans ligne), puis les lignes
 * `assessment_copy_pages`, et pose `copies_purged_at`. L'éval, les notes et leur détail restent.
 *
 * Garde-fou (migration 056) : seules les copies qui ont une transcription
 * (`assessment_copy_transcripts`) perdent leurs scans. Les autres restent ; l'éval n'est alors
 * pas marquée purgée et elle est reprise chaque nuit, jusqu'à ce que toutes soient transcrites.
 *
 * Authentification : en-tête `x-purge-token`, comparé au jeton rangé dans Vault par la
 * migration (fonction `purge_copies_token_ok`, réservée à service_role). Pas de JWT : l'appel
 * vient de la base, pas d'un utilisateur. Corps facultatif `{ "dryRun": true }` : liste sans rien
 * supprimer.
 */

const BUCKET = "assessment-copies";
const CHUNK = 100;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Tous les fichiers sous `<user>/<assessment>/` (un sous-dossier par élève). */
async function listAssessmentFiles(sb: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data: folders, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const entry of folders ?? []) {
    // Un dossier n'a pas d'id dans la réponse de list() ; un fichier en a un.
    if (entry.id) {
      out.push(`${prefix}/${entry.name}`);
      continue;
    }
    const sub = `${prefix}/${entry.name}`;
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: e2 } = await sb.storage.from(BUCKET).list(sub, { limit: 1000, offset });
      if (e2) throw e2;
      for (const f of files ?? []) if (f.id) out.push(`${sub}/${f.name}`);
      if (!files || files.length < 1000) break;
    }
  }
  return out;
}

serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const token = req.headers.get("x-purge-token") ?? "";
  const { data: ok, error: tokenError } = await sb.rpc("purge_copies_token_ok", { p_token: token });
  if (tokenError) return json({ error: "token_check_failed" }, 500);
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    // corps vide : purge réelle
  }

  const now = new Date().toISOString();
  const { data: due, error: dueError } = await sb
    .from("written_assessments")
    .select("id, user_id")
    .not("copies_purge_at", "is", null)
    .lte("copies_purge_at", now)
    .is("copies_purged_at", null);
  if (dueError) return json({ error: dueError.message }, 500);

  const report: { assessmentId: string; files: number; pages: number; kept: number; error?: string }[] = [];
  for (const a of due ?? []) {
    try {
      const { data: pages, error: pagesError } = await sb
        .from("assessment_copy_pages")
        .select("student_id, storage_path")
        .eq("assessment_id", a.id);
      if (pagesError) throw pagesError;

      const { data: transcripts, error: trError } = await sb
        .from("assessment_copy_transcripts")
        .select("student_id")
        .eq("assessment_id", a.id);
      if (trError) throw trError;
      const transcribed = new Set((transcripts ?? []).map((t) => t.student_id as string));

      // Élèves dont on garde les scans : des pages, pas de transcription.
      const kept = new Set(
        (pages ?? []).map((p) => p.student_id as string).filter((s) => !transcribed.has(s)),
      );
      // Chemin : <user>/<assessment>/<student>/<page>.jpg ; un fichier hors dossier d'élève ne part
      // qu'avec le dernier élève.
      const studentOf = (path: string) => path.split("/")[2] ?? "";
      const deletable = (path: string) =>
        kept.size === 0 || (path.split("/").length >= 4 && transcribed.has(studentOf(path)));

      const paths = new Set(
        (pages ?? []).filter((p) => transcribed.has(p.student_id as string)).map((p) => p.storage_path as string),
      );
      for (const f of await listAssessmentFiles(sb, `${a.user_id}/${a.id}`)) if (deletable(f)) paths.add(f);
      const all = [...paths];
      const purgedPages = (pages ?? []).filter((p) => transcribed.has(p.student_id as string)).length;

      if (!dryRun) {
        for (let i = 0; i < all.length; i += CHUNK) {
          const { error: rmError } = await sb.storage.from(BUCKET).remove(all.slice(i, i + CHUNK));
          if (rmError) throw rmError;
        }
        if (transcribed.size > 0) {
          const { error: delError } = await sb
            .from("assessment_copy_pages")
            .delete()
            .eq("assessment_id", a.id)
            .in("student_id", [...transcribed]);
          if (delError) throw delError;
        }
      }
      // Rien à supprimer (éval publiée sans scan) : on ne la marque pas « purgée », sinon l'écran
      // du prof afficherait « scans supprimés » pour des copies qui n'ont jamais existé.
      // Des copies sans transcription restent : pas « purgée » non plus, on repasse demain.
      if (!dryRun && kept.size === 0 && (all.length > 0 || (pages?.length ?? 0) > 0)) {
        const { error: markError } = await sb
          .from("written_assessments")
          .update({ copies_purged_at: new Date().toISOString() })
          .eq("id", a.id);
        if (markError) throw markError;
      }
      report.push({ assessmentId: a.id, files: all.length, pages: purgedPages, kept: kept.size });
    } catch (e) {
      // Une éval en échec n'empêche pas les autres ; elle sera reprise la nuit suivante.
      report.push({ assessmentId: a.id, files: 0, pages: 0, kept: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({
    dryRun,
    due: report.length,
    files: report.reduce((n, r) => n + r.files, 0),
    kept: report.reduce((n, r) => n + r.kept, 0),
    failed: report.filter((r) => r.error).length,
    report,
  });
});
