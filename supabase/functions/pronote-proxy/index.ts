// Relais vers Pronote : le navigateur ne peut pas appeler Pronote directement (CORS).
//
// Ce relais a longtemps accepté n'importe quelle adresse, sans connexion : n'importe qui pouvait
// s'en servir pour envoyer des requêtes anonymes où il voulait, au nom du projet. Deux verrous :
//   1. l'appelant doit être un enseignant connecté (jeton de session valide, compte non anonyme) ;
//   2. la cible doit être un serveur Pronote, en https, sur le port par défaut.
//
// Un Pronote hébergé ailleurs que chez Index Éducation s'ajoute par le secret
// PRONOTE_ALLOWED_HOSTS (suffixes séparés par des virgules, ex. « pronote.mon-college.fr »).

import { allowedTarget } from "./target.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ALLOWED_HOST_SUFFIXES = [
  "index-education.net",
  "index-education.com",
  ...(Deno.env.get("PRONOTE_ALLOWED_HOSTS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^\.+/, ""))
    .filter(Boolean),
];

function cors(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // « * » ne couvre pas Authorization : on renvoie la liste demandée par le navigateur.
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "authorization, content-type",
    "Access-Control-Expose-Headers": "x-gc-proxy-error",
  };
}

function refuse(req: Request, status: number, code: string): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "x-gc-proxy-error": code },
  });
}

// Un jeton déjà vérifié reste admis cinq minutes : une session Pronote enchaîne les requêtes.
const verified = new Map<string, number>();
const VERIFIED_MS = 5 * 60 * 1000;

async function isTeacher(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  const now = Date.now();
  const until = verified.get(jwt);
  if (until && until > now) return true;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return false;
  const user = await res.json().catch(() => null);
  if (!user?.id || user.is_anonymous) return false;

  if (verified.size > 500) verified.clear();
  verified.set(jwt, now + VERIFIED_MS);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "GET" && req.method !== "POST") return refuse(req, 405, "method_not_allowed");

  if (!(await isTeacher(req))) return refuse(req, 401, "unauthorized");

  const target = allowedTarget(new URL(req.url).searchParams.get("url") ?? "", ALLOWED_HOST_SUFFIXES);
  if (!target) return refuse(req, 403, "host_not_allowed");

  try {
    const forwardHeaders: Record<string, string> = {};
    const contentType = req.headers.get("content-type");
    if (contentType) forwardHeaders["content-type"] = contentType;
    // En-têtes destinés à Pronote : préfixe x-pronote-, retiré avant l'envoi.
    req.headers.forEach((val, key) => {
      if (key.startsWith("x-pronote-")) forwardHeaders[key.replace("x-pronote-", "")] = val;
    });

    const response = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method === "POST" ? await req.text() : undefined,
      // Une redirection repasse par le relais, donc par le contrôle de l'hôte.
      redirect: "manual",
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      if (!key.toLowerCase().startsWith("access-control-")) responseHeaders[key] = val;
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { ...responseHeaders, ...cors(req) },
    });
  } catch {
    return refuse(req, 502, "proxy_error");
  }
});
