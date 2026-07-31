const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

const PRIMARY_ORIGIN = "https://vitalis-alis-assist.lovable.app";

function isAllowed(origin: string): boolean {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  if (origin === PRIMARY_ORIGIN) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return protocol === "http:" && hostname === "localhost";
    return hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowed(origin) ? origin : PRIMARY_ORIGIN,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Vary": "Origin",
  };
}
