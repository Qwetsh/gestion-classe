// Convertisseur YouTube (MP3 / MP4) : la clé RapidAPI reste ici, côté serveur.
//
// Elle a été écrite en clair dans le code du site, donc publique. Désormais :
//   - la clé est le secret RAPIDAPI_KEY de la fonction, jamais envoyée au navigateur ;
//   - l'appelant doit être un enseignant connecté (compte non anonyme) ;
//   - le plafond mensuel et la liste des comptes autorisés au MP4 sont appliqués ici,
//     et non plus dans le navigateur où n'importe qui pouvait les contourner.
//
// Secrets : RAPIDAPI_KEY (obligatoire), RAPIDAPI_USER_MD5 (en-tête « x-run » du lien MP3),
// YT_MP4_ALLOWED_EMAILS (adresses séparées par des virgules ; vide = MP4 fermé à tous).
//
// GET ?info=1              -> { configured, monthly_count, monthly_limit, mp4_allowed }
// GET ?format=mp3&id=…     -> réponse du service MP3 (+ run)
// GET ?format=mp4&id=…     -> réponse du service MP4

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const RAPIDAPI_USER_MD5 = Deno.env.get("RAPIDAPI_USER_MD5") ?? "";
const MP4_ALLOWED = (Deno.env.get("YT_MP4_ALLOWED_EMAILS") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const HOST_MP3 = "youtube-mp36.p.rapidapi.com";
const HOST_MP4 = "youtube-mp4-downloader.p.rapidapi.com";
// Tous comptes confondus : le quota RapidAPI est commun.
const MONTHLY_LIMIT = 500;
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

function cors(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "authorization, content-type",
  };
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await sb.auth.getUser(jwt);
  const user = auth?.user;
  if (!user || user.is_anonymous) return json({ error: "unauthorized" }, 401);

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("yt_download_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString());
  const monthlyCount = count ?? 0;
  const mp4Allowed = MP4_ALLOWED.includes((user.email ?? "").toLowerCase());

  const params = new URL(req.url).searchParams;
  if (params.get("info")) {
    return json({
      configured: RAPIDAPI_KEY !== "",
      monthly_count: monthlyCount,
      monthly_limit: MONTHLY_LIMIT,
      mp4_allowed: mp4Allowed,
    });
  }

  const format = params.get("format") === "mp4" ? "mp4" : "mp3";
  const videoId = params.get("id") ?? "";
  if (!VIDEO_ID.test(videoId)) return json({ error: "bad_request" }, 400);
  if (!RAPIDAPI_KEY) return json({ error: "not_configured" }, 503);
  if (format === "mp4" && !mp4Allowed) return json({ error: "mp4_not_allowed" }, 403);
  if (monthlyCount >= MONTHLY_LIMIT) return json({ error: "monthly_limit" }, 429);

  try {
    const host = format === "mp4" ? HOST_MP4 : HOST_MP3;
    const path = format === "mp4"
      ? `/mp4?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
      : `/dl?id=${encodeURIComponent(videoId)}`;
    const response = await fetch(`https://${host}${path}`, {
      headers: { "x-rapidapi-host": host, "x-rapidapi-key": RAPIDAPI_KEY },
    });
    const data = await response.json().catch(() => ({}));

    const done = format === "mp4" ? data?.success === true && !!data?.download : data?.status === "ok" && !!data?.link;
    if (done) await sb.from("yt_download_log").insert({ user_id: user.id });

    return json(format === "mp3" ? { ...data, run: RAPIDAPI_USER_MD5 } : data, response.ok ? 200 : 502);
  } catch {
    return json({ error: "proxy_error" }, 502);
  }
});
