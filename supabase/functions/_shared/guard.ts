import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { getCaller } from "./auth.ts";
import { checkRateLimit } from "./rateLimit.ts";
import { jsonResponse, preflight } from "./http.ts";

type Guard =
  | { response: Response; user?: never; admin?: never; cors?: never; json?: never }
  | {
      response: null;
      user: User;
      admin: SupabaseClient;
      cors: Record<string, string>;
      json: (body: unknown, status?: number) => Response;
    };

/**
 * The single authoritative security gate: CORS → auth → per-user rate limit.
 * Usage: `const g = await guard(req, { bucket, limit }); if (g.response) return g.response;`
 */
export async function guard(
  req: Request,
  { bucket, limit }: { bucket: string; limit: number },
): Promise<Guard> {
  const cors = corsHeaders(req);

  const options = preflight(req);
  if (options) return { response: options };

  const user = await getCaller(req);
  if (!user) return { response: jsonResponse({ error: "Unauthorized" }, cors, 401) };

  const admin = adminClientLazy();
  const rl = await checkRateLimit(admin, user.id, bucket, { limit, windowSec: 60 });
  if (!rl.allowed) {
    return {
      response: jsonResponse({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, cors, 429),
    };
  }

  return {
    response: null,
    user,
    admin,
    cors,
    json: (body: unknown, status = 200) => jsonResponse(body, cors, status),
  };
}

import { adminClient } from "./supabase.ts";
const adminClientLazy = adminClient;
