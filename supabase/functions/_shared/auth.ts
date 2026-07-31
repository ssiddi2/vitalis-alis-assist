import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Returns the authenticated user from the request's Authorization header, or null. */
export async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** True if the user is a member of the given hospital. */
export async function userHasHospitalAccess(
  adminClient: SupabaseClient,
  userId: string,
  hospitalId?: string | null,
): Promise<boolean> {
  if (!hospitalId || !userId) return false;
  const { data, error } = await adminClient
    .from("hospital_users")
    .select("user_id")
    .eq("user_id", userId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  return !error && !!data;
}
