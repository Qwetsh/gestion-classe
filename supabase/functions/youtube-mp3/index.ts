import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") || "";
const RAPIDAPI_HOST = "youtube-mp36.p.rapidapi.com";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get("id");

  if (!videoId) {
    return new Response(JSON.stringify({ error: "Missing id parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/dl?id=${encodeURIComponent(videoId)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": RAPIDAPI_HOST,
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
      }
    );

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return new Response(
      JSON.stringify({ status: "fail", msg: message }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
