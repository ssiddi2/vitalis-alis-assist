import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Service-role client. Single definition so credentials can't drift per-function. */
export const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
