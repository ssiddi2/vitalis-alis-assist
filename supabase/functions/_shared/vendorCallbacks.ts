/**
 * Inbound vendor callback verification.
 *
 * No vendor's official signature scheme has been provisioned for this tenant,
 * so `verifyCallback` fails closed for every vendor and the caller MUST
 * quarantine the event. Inventing a verification scheme is prohibited: an
 * unverifiable connector is marked incomplete instead.
 */

import { sha256Hex } from "./gateway.ts";
import type { VendorKey } from "./vendors.ts";

export const TIMESTAMP_TOLERANCE_SEC = 300;

/** Events a connector is allowed to accept at all. Anything else is quarantined. */
export const EVENT_ALLOWLIST: Record<VendorKey, string[]> = {
  dosespot: ["NewRx", "CancelRx", "CancelRxResponse", "RxRenewalRequest", "RxChangeRequest", "RxFill", "PrescriptionStatus"],
  stedi: ["transaction.processed", "277ca.received", "835.received", "claim.status.updated"],
  health_gorilla: ["DiagnosticReport", "Observation", "DocumentReference", "ServiceRequest.status"],
  docupdate: [],
};

export interface CallbackVerdict {
  verified: boolean;
  reason: string;
  payloadHash: string;
  eventType: string | null;
  correlationId: string | null;
}

/** HMAC-SHA256 hex comparison in constant time. Used only when a vendor secret is provisioned. */
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const seen = new Map<string, number>();

/** Replay protection: a payload hash is accepted at most once per tolerance window. */
export function isReplay(payloadHash: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > TIMESTAMP_TOLERANCE_SEC * 1000) seen.delete(k);
  if (seen.has(payloadHash)) return true;
  seen.set(payloadHash, now);
  return false;
}

export async function verifyCallback(
  vendor: VendorKey,
  headers: Headers,
  rawBody: string,
  eventType: string | null,
  correlationId: string | null,
): Promise<CallbackVerdict> {
  const payloadHash = await sha256Hex(rawBody);
  const base: Omit<CallbackVerdict, "verified" | "reason"> = { payloadHash, eventType, correlationId };

  if (!EVENT_ALLOWLIST[vendor]?.length) return { ...base, verified: false, reason: "no_event_allowlist_for_vendor" };
  if (!eventType || !EVENT_ALLOWLIST[vendor].includes(eventType)) return { ...base, verified: false, reason: "event_type_not_allowlisted" };

  const ts = headers.get("x-vendor-timestamp");
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > TIMESTAMP_TOLERANCE_SEC) {
    return { ...base, verified: false, reason: "timestamp_missing_or_outside_tolerance" };
  }
  if (isReplay(payloadHash)) return { ...base, verified: false, reason: "replay_detected" };

  // The signing scheme must come from the vendor's official documentation. Until
  // the tenant's vendor signing secret is provisioned server-side we fail closed.
  const secret = Deno.env.get(`${vendor.toUpperCase()}_WEBHOOK_SECRET`);
  const signature = headers.get("x-vendor-signature");
  if (!secret || !signature) return { ...base, verified: false, reason: "vendor_signature_scheme_not_provisioned" };

  const expected = await hmacHex(secret, `${ts}.${rawBody}`);
  return timingSafeEqual(expected, signature)
    ? { ...base, verified: true, reason: "verified" }
    : { ...base, verified: false, reason: "signature_mismatch" };
}
