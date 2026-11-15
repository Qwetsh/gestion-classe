import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeBase64, encodeBase64Url } from "jsr:@std/encoding@1";

/**
 * Dépôt de cours par jeton d'import (migration 075, PLAN_preparation_semaine.md étape 1).
 *
 * Claude prépare les cours sur l'ordinateur du professeur. Il ne peut ni se connecter à son
 * compte ni déposer un fichier par une requête SQL : il passe par cette fonction, avec un jeton
 * que le professeur crée dans Réglages et peut révoquer.
 *
 * Corps { action, … } :
 *  - "create"  (JWT du prof)  { label? }            → { id, token, expires_at }   jeton montré une fois
 *  - "revoke"  (JWT du prof)  { id }                → { ok }
 *  - "whoami"  (jeton)        { token }             → { user_id, label, expires_at }
 *  - "image"   (jeton)        { token, image (base64) }  → { path, bytes, type }
 *      PNG, JPEG, WebP ou GIF, 8 Mo au plus ; rangée dans board-assets/<user_id>/import/
 *  - "course"  (jeton)        { token, title, level?, chapter?, doc }  → { id }   nouveau cours
 *      avec { board_id, replace: true } : remplace le document d'un cours existant, après en
 *      avoir gardé une version ; les écrans et le titre du cours sont conservés
 *  - "screens" (jeton)        { token, board_id, pages }  → { pages }   écrans d'un cours
 *      refusé si le cours a déjà des écrans, sauf { replace: true } (les anciens sont supprimés)
 *  - "agenda"  (jeton)        { token, from?, days? }  → { lessons, library }
 *      cours de l'emploi du temps (14 jours par défaut, 60 au plus) avec leur classe et le
 *      document déjà placé, et les originaux de la bibliothèque (titres, sans leur contenu)
 *  - "place"   (jeton)        { token, source_board_id, lessons: [{ starts_at, label }] }
 *      → { results: [{ starts_at, label, status, board_id?, title? }] }
 *      une copie de l'original par cours, reliée au cours avec sa provenance ; un cours qui a déjà
 *      un document n'est jamais écrasé (status "occupied", ou "already" si c'est le même original)
 *  - "unplace" (jeton)        { token, board_id, force? }  → { ok }
 *      retire la copie d'un cours ; refusé si une séance l'a utilisée, et si elle a été ouverte ou
 *      modifiée depuis sa pose (sauf { force: true }, sur demande du professeur)
 *
 * Le jeton n'écrit que dans l'espace de son propriétaire. Il ne lit que l'emploi du temps et les
 * titres de la bibliothèque (action "agenda") : rien sur les élèves, aucun contenu de cours.
 * Ce que la fonction vérifie : la forme des données, la taille, l'appartenance des images citées
 * et le HTML des objets du tableau blanc (balises de mise en forme seulement). La validation
 * fine d'un document de cours reste celle de `npm run course:check`, avant l'envoi.
 *
 * verify_jwt est désactivé (un script n'a pas de session) : "create" et "revoke" vérifient
 * eux-mêmes le JWT du professeur.
 */

const BUCKET = "board-assets";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOC_CHARS = 2_000_000;
const MAX_PAGES_CHARS = 3_000_000;
const MAX_PAGES = 60;
const MAX_ACTIVE_TOKENS = 5;
const LEVELS = ["6e", "5e", "4e", "3e", "Autre"];
const BACKGROUNDS = ["blank", "grid", "lines", "seyes", "graph", "axes", "dots"];

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
const PAGE_ID = /^[A-Za-z0-9_-]{1,40}$/;

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

/** Jeton encore valable (non révoqué, non expiré), ou null. Note son dernier usage. */
async function liveToken(sb: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  const { data } = await sb
    .from("import_tokens")
    .select("id, user_id, label, expires_at, revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  await sb.from("import_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data as { id: string; user_id: string; label: string; expires_at: string };
}

/** Type d'image reconnu à ses premiers octets (jamais à son nom ni à ce qu'annonce l'appelant). */
function imageType(b: Uint8Array): { ext: string; mime: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 5 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { ext: "gif", mime: "image/gif" };
  if (b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/** Parcourt un arbre JSON et rend chaque objet rencontré. */
function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
  } else if (node && typeof node === "object") {
    yield node as Record<string, unknown>;
    for (const child of Object.values(node)) yield* walk(child);
  }
}

/** Chemins d'images cités par un document de cours (nœuds `image`). */
function courseImagePaths(doc: unknown): string[] {
  const paths: string[] = [];
  for (const n of walk(doc)) {
    if (n.type !== "image") continue;
    const attrs = n.attrs as Record<string, unknown> | undefined;
    if (typeof attrs?.path === "string") paths.push(attrs.path);
  }
  return paths;
}

/** Chemins de fichiers cités par des pages de tableau blanc (image de fond, objets, caches). */
function pageFilePaths(pages: unknown): string[] {
  const paths: string[] = [];
  for (const n of walk(pages)) {
    for (const key of ["path", "imagePath"]) {
      if (typeof n[key] === "string") paths.push(n[key] as string);
    }
  }
  return paths;
}

/** Les fichiers cités doivent être ceux du propriétaire du jeton, et exister. */
async function missingFile(sb: SupabaseClient, userId: string, paths: string[]): Promise<string | null> {
  for (const path of new Set(paths)) {
    if (!path.startsWith(`${userId}/`) || path.includes("..")) return path;
    const { data, error } = await sb.storage.from(BUCKET).exists(path);
    if (error || !data) return path;
  }
  return null;
}

const ALLOWED_TAG = /^<\/?(div|p|li|ul|ol|h1|h2|h3|blockquote|b|strong|i|em|u|s|strike|del|span|sub|sup|br|font)(\s[^<>]*)?\/?>$/i;
const UNSAFE_ATTR = /\son[a-z]+\s*=|javascript:|expression\s*\(|url\s*\(|\ssrc\s*=|\shref\s*=/i;

/** Le HTML d'un objet du tableau blanc ne contient que des balises de mise en forme. */
function htmlOk(html: unknown): boolean {
  if (typeof html !== "string") return false;
  const tags = html.match(/<[^>]*>?/g) ?? [];
  return tags.every((tag) => ALLOWED_TAG.test(tag) && !UNSAFE_ATTR.test(tag));
}

/** Premier défaut d'une suite de pages, ou null. */
function pagesProblem(pages: unknown): string | null {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > MAX_PAGES) return "bad_pages";
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page || typeof page !== "object") return "bad_page";
    const p = page as Record<string, unknown>;
    if (typeof p.id !== "string" || !PAGE_ID.test(p.id) || seen.has(p.id)) return "bad_page_id";
    seen.add(p.id);
    if (p.background !== undefined && !BACKGROUNDS.includes(String(p.background))) return "bad_background";
    if (!Array.isArray(p.objects)) return "bad_objects";
    if (p.strokes !== undefined && !Array.isArray(p.strokes)) return "bad_strokes";
    for (const o of p.objects) {
      if (!o || typeof o !== "object") return "bad_object";
      const obj = o as Record<string, unknown>;
      if (typeof obj.id !== "string" || typeof obj.type !== "string") return "bad_object";
      if (typeof obj.x !== "number" || typeof obj.y !== "number" || typeof obj.w !== "number") return "bad_object";
    }
  }
  // Tout HTML porté par un objet (texte, texte d'une forme, fenêtre, cellules d'un tableau)
  for (const n of walk(pages)) {
    if ("html" in n && !htmlOk(n.html)) return "bad_html";
    if (Array.isArray(n.cells)) {
      for (const row of n.cells) {
        if (!Array.isArray(row) || !row.every((cell) => htmlOk(cell))) return "bad_html";
      }
    }
  }
  return null;
}

/** Réglages d'une page à ranger dans board_pages.meta (migration 074), ou null. */
function pageMeta(p: Record<string, unknown>): Record<string, unknown> | null {
  const meta: Record<string, unknown> = {};
  if (typeof p.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color)) meta.color = p.color;
  if (p.curtain === true) meta.curtain = true;
  if (typeof p.height === "number" && Number.isFinite(p.height) && p.height > 562.5) meta.height = p.height;
  return Object.keys(meta).length > 0 ? meta : null;
}

const newRev = () => `claude-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---- Emploi du temps (actions "agenda", "place") ----

const DEFAULT_DAYS = 14;
const MAX_DAYS = 60;
const MAX_PLACES = 30;
/** Une copie ouverte ou retouchée après sa pose n'est pas retirée sans { force: true }. */
const EDIT_GRACE_MS = 2 * 60 * 1000;

/** Minuscules, sans accents ni ponctuation (même règle que lib/timetable/labelMatching.ts). */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Début d'un cours à la minute : la clé de lesson_boards (cf. lessonBoardsQueries.ts). */
function minuteIso(d: Date): string {
  const t = new Date(d);
  t.setSeconds(0, 0);
  return t.toISOString();
}

interface Lesson {
  starts_at: string;
  ends_at: string;
  label: string;
  class_id: string;
  class_name: string;
  group_id: string | null;
  group_name: string | null;
  status: string;
}

/**
 * Cours d'une classe qui commencent dans [from, to[, hors cours annulés. La classe vient de la
 * correspondance mémorisée du libellé (timetable_label_links) ; sans elle, d'une classe au nom
 * identique. Un libellé ignoré, ou sans classe, n'est pas un cours d'une de mes classes.
 */
async function lessonsBetween(sb: SupabaseClient, userId: string, from: Date, to: Date): Promise<Lesson[]> {
  const [entries, links, classes, groups] = await Promise.all([
    sb.from("timetable_entries").select("starts_at, ends_at, label, class_label, status")
      .eq("user_id", userId).eq("kind", "lesson")
      .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at"),
    sb.from("timetable_label_links").select("label, class_id, group_id, ignored").eq("user_id", userId),
    sb.from("classes").select("id, name, is_deleted").eq("user_id", userId),
    sb.from("class_groups").select("id, class_id, name").eq("user_id", userId),
  ]);
  if (entries.error) throw entries.error;
  const live = (classes.data ?? []).filter((c) => c.is_deleted !== true) as { id: string; name: string }[];
  const groupList = (groups.data ?? []) as { id: string; class_id: string; name: string }[];
  const linkMap = new Map((links.data ?? []).map((l) => [l.label as string, l as { class_id: string | null; group_id: string | null; ignored: boolean }]));
  const out: Lesson[] = [];
  for (const e of entries.data ?? []) {
    if (e.status === "canceled") continue;
    const link = linkMap.get(e.label);
    let cls: { id: string; name: string } | null = null;
    let grp: { id: string; name: string } | null = null;
    if (link) {
      if (link.ignored || !link.class_id) continue;
      cls = live.find((c) => c.id === link.class_id) ?? null;
      grp = link.group_id ? groupList.find((g) => g.id === link.group_id && g.class_id === link.class_id) ?? null : null;
    } else {
      const target = norm(e.class_label ?? e.label);
      const same = live.filter((c) => norm(c.name) === target);
      cls = same.length === 1 ? same[0] : null;
    }
    if (!cls) continue;
    out.push({
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      label: e.label,
      class_id: cls.id,
      class_name: cls.name,
      group_id: grp?.id ?? null,
      group_name: grp?.name ?? null,
      status: e.status,
    });
  }
  return out;
}

/** Original d'un cours : l'original de la copie s'il est placé, sinon le cours lui-même. */
async function originOf(sb: SupabaseClient, userId: string, boardId: string): Promise<string | null> {
  const { data } = await sb.from("lesson_boards").select("source_board_id").eq("user_id", userId).eq("board_id", boardId).maybeSingle();
  return data ? (data.source_board_id as string | null) ?? null : boardId;
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
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
      const { count } = await sb
        .from("import_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString());
      if ((count ?? 0) >= MAX_ACTIVE_TOKENS) return json({ error: "too_many_tokens" }, 409);
      const token = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const { data, error } = await sb
        .from("import_tokens")
        .insert({ token_hash: await sha256(token), user_id: user.id, label })
        .select("id, expires_at")
        .single();
      if (error || !data) return json({ error: "token_failed" }, 500);
      return json({ id: data.id, token, expires_at: data.expires_at });
    }

    case "revoke": {
      const user = await currentUser(sb, req);
      if (!user) return json({ error: "unauthorized" }, 401);
      const id = String(body.id ?? "");
      if (!UUID.test(id)) return json({ error: "bad_request" }, 400);
      await sb
        .from("import_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .is("revoked_at", null);
      return json({ ok: true });
    }

    case "whoami": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      return json({ user_id: t.user_id, label: t.label, expires_at: t.expires_at });
    }

    case "image": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      if (typeof body.image !== "string") return json({ error: "bad_request" }, 400);
      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(body.image);
      } catch {
        return json({ error: "bad_image" }, 400);
      }
      if (bytes.length > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 413);
      const type = imageType(bytes);
      if (!type) return json({ error: "bad_image" }, 400);
      const path = `${t.user_id}/import/${crypto.randomUUID()}.${type.ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: type.mime, upsert: false });
      if (error) return json({ error: "upload_failed" }, 500);
      return json({ path, bytes: bytes.length, type: type.mime });
    }

    case "course": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      const doc = body.doc as Record<string, unknown> | null;
      const content = doc?.content as Record<string, unknown> | undefined;
      if (!doc || typeof doc !== "object" || doc.version !== 1 || content?.type !== "doc" || !Array.isArray(content.content)) {
        return json({ error: "bad_doc" }, 400);
      }
      if (JSON.stringify(doc).length > MAX_DOC_CHARS) return json({ error: "too_large" }, 413);
      const lost = await missingFile(sb, t.user_id, courseImagePaths(doc));
      if (lost) return json({ error: "missing_image", path: lost }, 400);
      const clean: Record<string, unknown> = { ...doc };
      delete clean.rev;

      // Remplacement d'un cours existant : explicite, et précédé d'une version
      if (body.board_id != null) {
        const boardId = String(body.board_id);
        if (!UUID.test(boardId)) return json({ error: "bad_request" }, 400);
        if (body.replace !== true) return json({ error: "replace_required" }, 409);
        const { data: board } = await sb.from("boards").select("id, doc").eq("id", boardId).eq("user_id", t.user_id).maybeSingle();
        const old = board?.doc as Record<string, unknown> | null | undefined;
        if (!board || !old) return json({ error: "not_found" }, 404);
        const { error: versionError } = await sb.from("board_doc_versions").insert({
          user_id: t.user_id,
          board_id: boardId,
          doc: old,
          kind: "manual",
          label: "Avant la modification par Claude",
        });
        if (versionError) return json({ error: "version_failed" }, 500);
        // La face écran n'est pas dans l'envoi d'un document : on garde celle du cours
        if (clean.screens === undefined && old.screens !== undefined) clean.screens = old.screens;
        clean.rev = newRev();
        const { error } = await sb.from("boards").update({ doc: clean, updated_at: new Date().toISOString() }).eq("id", boardId).eq("user_id", t.user_id);
        if (error) return json({ error: "write_failed" }, 500);
        return json({ id: boardId, replaced: true });
      }

      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 200) return json({ error: "bad_title" }, 400);
      const level = body.level == null ? null : String(body.level);
      if (level !== null && !LEVELS.includes(level)) return json({ error: "bad_level" }, 400);
      const chapter = body.chapter == null ? null : String(body.chapter).trim().slice(0, 120) || null;
      const { data, error } = await sb
        .from("boards")
        .insert({ user_id: t.user_id, title, level, chapter, doc: clean })
        .select("id")
        .single();
      if (error || !data) return json({ error: "write_failed" }, 500);
      return json({ id: data.id });
    }

    case "screens": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      const boardId = String(body.board_id ?? "");
      if (!UUID.test(boardId)) return json({ error: "bad_request" }, 400);
      const problem = pagesProblem(body.pages);
      if (problem) return json({ error: problem }, 400);
      const pages = body.pages as Record<string, unknown>[];
      if (JSON.stringify(pages).length > MAX_PAGES_CHARS) return json({ error: "too_large" }, 413);
      const lost = await missingFile(sb, t.user_id, pageFilePaths(pages));
      if (lost) return json({ error: "missing_image", path: lost }, 400);

      const { data: board } = await sb.from("boards").select("id, doc").eq("id", boardId).eq("user_id", t.user_id).maybeSingle();
      const doc = board?.doc as Record<string, unknown> | null | undefined;
      if (!board || !doc) return json({ error: "not_found" }, 404);
      const oldIds = Array.isArray(doc.screens) ? (doc.screens as unknown[]).filter((id): id is string => typeof id === "string") : [];
      if (oldIds.length > 0 && body.replace !== true) return json({ error: "screens_exist", count: oldIds.length }, 409);

      const ids = pages.map((p) => p.id as string);
      // Une page du cours qui n'est pas un écran (page d'encart) ne doit pas être écrasée
      const { data: existing } = await sb.from("board_pages").select("page_id").eq("board_id", boardId).in("page_id", ids);
      const clash = (existing ?? []).map((r) => r.page_id as string).find((id) => !oldIds.includes(id));
      if (clash) return json({ error: "page_id_taken", page_id: clash }, 409);

      if (oldIds.length > 0) {
        const { error } = await sb.from("board_pages").delete().eq("board_id", boardId).in("page_id", oldIds);
        if (error) return json({ error: "write_failed" }, 500);
      }
      const now = new Date().toISOString();
      const rows = pages.map((p, position) => ({
        user_id: t.user_id,
        board_id: boardId,
        page_id: p.id,
        position,
        background: p.background ?? "blank",
        strokes: p.strokes ?? [],
        image: p.image ?? null,
        objects: p.objects,
        meta: pageMeta(p),
        updated_at: now,
      }));
      const { error: insertError } = await sb.from("board_pages").insert(rows);
      if (insertError) return json({ error: "write_failed" }, 500);
      const { error } = await sb
        .from("boards")
        .update({ doc: { ...doc, screens: ids, rev: newRev() }, updated_at: now })
        .eq("id", boardId)
        .eq("user_id", t.user_id);
      if (error) return json({ error: "write_failed" }, 500);
      return json({ id: boardId, pages: ids.length, replaced: oldIds.length > 0 });
    }

    case "agenda": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      const from = body.from == null ? new Date() : new Date(String(body.from));
      const days = body.days == null ? DEFAULT_DAYS : Number(body.days);
      if (Number.isNaN(from.getTime()) || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) return json({ error: "bad_request" }, 400);
      const to = new Date(from.getTime() + days * 86_400_000);
      let lessons: Lesson[];
      try {
        lessons = await lessonsBetween(sb, t.user_id, from, to);
      } catch {
        return json({ error: "read_failed" }, 500);
      }
      // Documents déjà placés (une seule clé étrangère lesson_boards → boards : l'embed est sûr)
      const { data: placed } = await sb
        .from("lesson_boards")
        .select("board_id, starts_at, label, source_board_id, boards(title)")
        .eq("user_id", t.user_id)
        .gte("starts_at", minuteIso(from))
        .lt("starts_at", to.toISOString());
      const byKey = new Map<string, Record<string, unknown>>();
      for (const p of placed ?? []) byKey.set(`${minuteIso(new Date(p.starts_at))}|${p.label}`, p);
      const { data: library } = await sb
        .from("boards")
        .select("id, title, level, chapter, is_template, updated_at, screens:doc->screens, version:doc->version")
        .eq("user_id", t.user_id)
        .is("class_id", null)
        .order("level")
        .order("chapter")
        .order("title");
      return json({
        lessons: lessons.map((l) => {
          const p = byKey.get(`${minuteIso(new Date(l.starts_at))}|${l.label}`);
          const b = p ? (Array.isArray(p.boards) ? p.boards[0] : p.boards) as { title?: string } | null : null;
          return { ...l, placed: p ? { board_id: p.board_id, title: b?.title ?? null, source_board_id: p.source_board_id ?? null } : null };
        }),
        library: (library ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          level: b.level,
          chapter: b.chapter,
          template: b.is_template === true,
          course: b.version != null,
          screens: Array.isArray(b.screens) ? b.screens.length : 0,
          updated_at: b.updated_at,
        })),
      });
    }

    case "place": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      const sourceId = String(body.source_board_id ?? "");
      const wanted = body.lessons;
      if (!UUID.test(sourceId) || !Array.isArray(wanted) || wanted.length === 0 || wanted.length > MAX_PLACES) return json({ error: "bad_request" }, 400);
      const { data: source } = await sb.from("boards").select("id, title, level, doc").eq("id", sourceId).eq("user_id", t.user_id).maybeSingle();
      if (!source) return json({ error: "not_found" }, 404);
      const origin = await originOf(sb, t.user_id, sourceId);
      const { data: pages, error: pagesError } = await sb
        .from("board_pages")
        .select("page_id, position, background, strokes, image, objects, meta")
        .eq("board_id", sourceId)
        .is("session_id", null)
        .order("position");
      if (pagesError) return json({ error: "read_failed" }, 500);

      const results: Record<string, unknown>[] = [];
      for (const w of wanted) {
        const item = (w ?? {}) as Record<string, unknown>;
        const label = typeof item.label === "string" ? item.label : "";
        const start = new Date(String(item.starts_at ?? ""));
        if (!label || Number.isNaN(start.getTime())) {
          results.push({ starts_at: item.starts_at ?? null, label, status: "bad_lesson" });
          continue;
        }
        const key = minuteIso(start);
        const base = { starts_at: key, label };
        let lesson: Lesson | undefined;
        try {
          lesson = (await lessonsBetween(sb, t.user_id, new Date(key), new Date(new Date(key).getTime() + 60_000))).find((l) => l.label === label);
        } catch {
          results.push({ ...base, status: "read_failed" });
          continue;
        }
        if (!lesson) {
          results.push({ ...base, status: "not_found" });
          continue;
        }
        const { data: existing } = await sb
          .from("lesson_boards")
          .select("board_id, source_board_id, boards(title)")
          .eq("user_id", t.user_id)
          .eq("label", label)
          .eq("starts_at", key)
          .maybeSingle();
        if (existing) {
          const b = (Array.isArray(existing.boards) ? existing.boards[0] : existing.boards) as { title?: string } | null;
          const same = origin !== null && existing.source_board_id === origin;
          results.push({ ...base, status: same ? "already" : "occupied", board_id: existing.board_id, title: b?.title ?? null });
          continue;
        }
        // Copie : même document (nouveau numéro d'enregistrement), mêmes pages, mêmes identifiants
        // de page (le document cite ses écrans et ses encarts par identifiant)
        const doc = source.doc ? { ...(source.doc as Record<string, unknown>), rev: newRev() } : null;
        const { data: copy, error: copyError } = await sb
          .from("boards")
          .insert({ user_id: t.user_id, title: source.title, level: source.level, chapter: null, class_id: lesson.class_id, doc })
          .select("id")
          .single();
        if (copyError || !copy) {
          results.push({ ...base, status: "write_failed" });
          continue;
        }
        const now = new Date().toISOString();
        let failed: string | null = null;
        if ((pages ?? []).length > 0) {
          const { error } = await sb.from("board_pages").insert((pages ?? []).map((p) => ({ ...p, user_id: t.user_id, board_id: copy.id, updated_at: now })));
          if (error) failed = "write_failed";
        }
        if (!failed) {
          const { error } = await sb.from("lesson_boards").insert({
            user_id: t.user_id,
            starts_at: key,
            ends_at: lesson.ends_at,
            label,
            class_id: lesson.class_id,
            group_id: lesson.group_id,
            board_id: copy.id,
            source_board_id: origin,
          });
          // Posé entre-temps par l'application (autre onglet) : le cours n'est pas écrasé
          if (error) failed = error.code === "23505" ? "occupied" : "write_failed";
        }
        if (failed) {
          await sb.from("boards").delete().eq("id", copy.id).eq("user_id", t.user_id);
          results.push({ ...base, status: failed });
          continue;
        }
        results.push({ ...base, status: "placed", board_id: copy.id, title: source.title, class_name: lesson.class_name, group_name: lesson.group_name });
      }
      return json({ results });
    }

    case "unplace": {
      const t = await liveToken(sb, body.token);
      if (!t) return json({ error: "invalid_token" }, 401);
      const boardId = String(body.board_id ?? "");
      if (!UUID.test(boardId)) return json({ error: "bad_request" }, 400);
      const { data: link } = await sb.from("lesson_boards").select("id, starts_at, label").eq("user_id", t.user_id).eq("board_id", boardId).maybeSingle();
      if (!link) return json({ error: "not_placed" }, 404);
      const { data: used } = await sb.from("session_boards").select("session_id").eq("board_id", boardId).limit(1);
      if ((used ?? []).length > 0) return json({ error: "used_in_session" }, 409);
      const { data: board } = await sb.from("boards").select("created_at, updated_at").eq("id", boardId).eq("user_id", t.user_id).maybeSingle();
      if (!board) return json({ error: "not_found" }, 404);
      const touched = new Date(board.updated_at).getTime() - new Date(board.created_at).getTime() > EDIT_GRACE_MS;
      if (touched && body.force !== true) return json({ error: "edited" }, 409);
      // Le lien et les pages partent avec la copie (ON DELETE CASCADE) ; l'original ne bouge pas
      const { error } = await sb.from("boards").delete().eq("id", boardId).eq("user_id", t.user_id);
      if (error) return json({ error: "write_failed" }, 500);
      return json({ ok: true, starts_at: link.starts_at, label: link.label });
    }

    default:
      return json({ error: "bad_request" }, 400);
  }
});
