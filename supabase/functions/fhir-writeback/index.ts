import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { respondWritebackDisabled } from "./respond.ts";

// External delivery remains disabled until authoritative facility binding,
// record ownership, signing integrity and durable replay controls are ready.
// Preserve authentication, CORS/preflight and rate limiting. Do not parse the
// client payload, access clinical records, or forward client-supplied tokens.
serve(async (req) => {
  const g = await guard(req, { bucket: "fhir-writeback", limit: envLimit("RL_FHIR_WRITE", 60) });
  return respondWritebackDisabled(g);
});
