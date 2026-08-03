import { corsHeaders } from "./cors.ts";

/** JSON response that always carries CORS headers. */
export function jsonResponse(body: unknown, cors: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Returns the CORS preflight response for OPTIONS requests, else null. */
export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { headers: corsHeaders(req) }) : null;
}
