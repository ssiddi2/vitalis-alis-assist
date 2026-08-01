import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Per-user fixed-window rate limiter backed by public.rate_limits.
 * Fails OPEN on any DB error so a limiter bug never blocks clinical features.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  bucket: string,
  { limit, windowSec = 60 }: { limit: number; windowSec?: number },
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase
      .from("rate_limits")
      .select("window_start, count")
      .eq("user_id", userId)
      .eq("bucket", bucket)
      .maybeSingle();
    if (error) throw error;

    const now = Date.now();
    const startedAt = data ? new Date(data.window_start).getTime() : 0;
    const elapsed = (now - startedAt) / 1000;

    if (!data || elapsed >= windowSec) {
      await supabase.from("rate_limits").upsert(
        { user_id: userId, bucket, window_start: new Date(now).toISOString(), count: 1 },
        { onConflict: "user_id,bucket" },
      );
      return { allowed: true };
    }

    if (data.count < limit) {
      await supabase.from("rate_limits").update({ count: data.count + 1 })
        .eq("user_id", userId).eq("bucket", bucket);
      return { allowed: true };
    }

    return { allowed: false, retryAfter: Math.max(1, Math.ceil(windowSec - elapsed)) };
  } catch (e) {
    console.warn(`[rateLimit] failing open for ${bucket}:`, e instanceof Error ? e.message : e);
    return { allowed: true };
  }
}

/** Reads a positive integer limit from env, falling back to a default. */
export function envLimit(name: string, fallback: number): number {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
