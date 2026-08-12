/**
 * Server-side outbound integration gateway.
 *
 * Every outbound vendor call goes through here so that SSRF protection, TLS,
 * timeouts, idempotency, correlation, retry/backoff, circuit breaking,
 * rate-limit handling and secret redaction exist in exactly one place.
 * PHI never enters a log line: only ids, hashes, status codes and durations.
 */

import { VENDORS, type VendorKey } from "./vendors.ts";
import { env } from "./env.ts";

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;

const breaker = new Map<string, { failures: number; openedAt: number }>();

export class GatewayError extends Error {
  constructor(public reason: string, public status = 502) {
    super(reason);
    this.name = "GatewayError";
  }
}

/** Refuse anything that is not an https URL on a documented vendor host. */
export function assertAllowedUrl(vendor: VendorKey, env: "sandbox" | "production", raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GatewayError("invalid_url", 400);
  }
  if (url.protocol !== "https:") throw new GatewayError("tls_required", 400);
  if (url.username || url.password) throw new GatewayError("credentials_in_url_denied", 400);
  const hosts = VENDORS[vendor]?.hosts[env] ?? [];
  if (!hosts.includes(url.hostname)) throw new GatewayError("host_not_allowlisted", 400);
  return url;
}

/** Strip anything secret-shaped before a value reaches a log, error or client. */
export function redact(input: unknown): string {
  let text = typeof input === "string" ? input : JSON.stringify(input ?? "");
  text = text
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(/("?(?:api[_-]?key|client_secret|access_token|refresh_token|password|authorization|secret)"?\s*[:=]\s*)"?[^",}\s]+"?/gi, '$1"[REDACTED]"')
    .replace(/\b[A-Za-z0-9-_]{12,}\.[A-Za-z0-9-_]{12,}\.[A-Za-z0-9-_]{12,}\b/g, "[REDACTED]");
  return text.slice(0, 500);
}

export interface GatewayCall {
  vendor: VendorKey;
  env: "sandbox" | "production";
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  /** Stable per logical operation: makes retries and vendor replays safe. */
  idempotencyKey: string;
  correlationId: string;
}

export interface GatewayResult {
  status: number;
  ok: boolean;
  json: unknown;
  correlationId: string;
  durationMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function gatewayFetch(call: GatewayCall): Promise<GatewayResult> {
  if (env("INTEGRATION_KILL_SWITCH") === "true") throw new GatewayError("kill_switch_active", 503);

  const url = assertAllowedUrl(call.vendor, call.env, call.url);
  const key = `${call.vendor}:${call.env}`;
  const b = breaker.get(key);
  if (b && b.failures >= BREAKER_THRESHOLD) {
    if (Date.now() - b.openedAt < BREAKER_COOLDOWN_MS) throw new GatewayError("circuit_open", 503);
    breaker.delete(key);
  }

  const started = Date.now();
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: call.method ?? "POST",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Idempotency-Key": call.idempotencyKey,
          "X-Correlation-Id": call.correlationId,
          ...(call.headers ?? {}),
        },
        body: call.method === "GET" ? undefined : JSON.stringify(call.body ?? {}),
      });
      lastStatus = res.status;
      const text = await res.text();
      let json: unknown = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: redact(text) }; }

      // Retry only on transient conditions; honour Retry-After for rate limits.
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(res.headers.get("retry-after")) * 1000;
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5_000) : 300 * 2 ** attempt);
          continue;
        }
      }
      if (!res.ok) bumpBreaker(key); else breaker.delete(key);
      log(call, res.status, Date.now() - started, attempt);
      return { status: res.status, ok: res.ok, json, correlationId: call.correlationId, durationMs: Date.now() - started };
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        bumpBreaker(key);
        log(call, lastStatus || 0, Date.now() - started, attempt, redact(err instanceof Error ? err.message : err));
        throw new GatewayError("vendor_unreachable", 504);
      }
      await sleep(300 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new GatewayError("vendor_unreachable", 504);
}

function bumpBreaker(key: string) {
  const cur = breaker.get(key) ?? { failures: 0, openedAt: Date.now() };
  breaker.set(key, { failures: cur.failures + 1, openedAt: Date.now() });
}

/** PHI-free structured log line. */
function log(call: GatewayCall, status: number, durationMs: number, attempt: number, error?: string) {
  console.log(JSON.stringify({
    evt: "integration_gateway",
    vendor: call.vendor,
    env: call.env,
    host: new URL(call.url).hostname,
    status, durationMs, attempt,
    correlationId: call.correlationId,
    idempotencyKey: call.idempotencyKey,
    ...(error ? { error } : {}),
  }));
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
