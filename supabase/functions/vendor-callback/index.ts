import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, preflight } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { redact } from "../_shared/gateway.ts";
import { verifyCallback } from "../_shared/vendorCallbacks.ts";
import type { VendorKey } from "../_shared/vendors.ts";

/**
 * Inbound vendor callback receiver (DoseSpot / Stedi / Health Gorilla).
 *
 * No vendor signing scheme is provisioned for this tenant, so EVERY event is
 * quarantined and nothing reaches a clinical record. Only a payload hash and
 * PHI-free routing metadata are stored — never the vendor payload itself.
 * This function is intentionally unauthenticated (vendors cannot present a JWT)
 * and is therefore write-only into quarantine.
 */
const VENDOR_KEYS = ["dosespot", "stedi", "health_gorilla"];

serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  const cors = corsHeaders(req);

  try {
    const vendor = new URL(req.url).searchParams.get("vendor") ?? "";
    if (!VENDOR_KEYS.includes(vendor)) return jsonResponse({ error: "unknown_vendor" }, cors, 404);

    const rawBody = (await req.text()).slice(0, 200_000);
    const eventType = req.headers.get("x-vendor-event") ?? null;
    const correlationId = req.headers.get("x-correlation-id") ?? null;

    const verdict = await verifyCallback(vendor as VendorKey, req.headers, rawBody, eventType, correlationId);

    await adminClient().from("vendor_callback_quarantine").upsert({
      vendor_key: vendor,
      environment: req.headers.get("x-vendor-environment") ?? "sandbox",
      event_type: eventType,
      correlation_id: correlationId,
      vendor_reference: req.headers.get("x-vendor-reference"),
      payload_hash: verdict.payloadHash,
      quarantine_reason: verdict.verified ? "verified_but_connector_incomplete" : verdict.reason,
    }, { onConflict: "vendor_key,payload_hash", ignoreDuplicates: true });

    console.log(JSON.stringify({
      evt: "vendor_callback_quarantined", vendor, eventType,
      reason: redact(verdict.reason), payloadHash: verdict.payloadHash,
    }));

    // Always 202: the event is accepted for review, never applied.
    return jsonResponse({ received: true, applied: false, quarantined: true }, cors, 202);
  } catch (err) {
    console.error("vendor-callback", redact(err instanceof Error ? err.message : err));
    return jsonResponse({ error: "Request failed" }, cors, 500);
  }
});
