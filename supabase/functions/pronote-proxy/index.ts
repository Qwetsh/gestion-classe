import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Build headers to forward to Pronote
    const forwardHeaders: Record<string, string> = {};
    const contentType = req.headers.get("content-type");
    if (contentType) {
      forwardHeaders["content-type"] = contentType;
    }

    // Forward any x-pronote-* headers (strip prefix)
    req.headers.forEach((val, key) => {
      if (key.startsWith("x-pronote-")) {
        forwardHeaders[key.replace("x-pronote-", "")] = val;
      }
    });

    // Read body if present
    let body: string | undefined;
    if (req.method === "POST") {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: "manual",
    });

    // Build response headers
    const responseHeaders: Record<string, string> = { ...corsHeaders };
    response.headers.forEach((val, key) => {
      // Forward relevant headers
      if (!["access-control-allow-origin", "access-control-allow-methods", "access-control-allow-headers"].includes(key.toLowerCase())) {
        responseHeaders[key] = val;
      }
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
