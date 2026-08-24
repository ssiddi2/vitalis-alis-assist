import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOperationUrl, HEALTH_GORILLA_TOKEN_URL, OperationError, stripX12, VENDOR_OPERATIONS,
} from "../../../supabase/functions/_shared/vendorEndpoints";
import { assertAllowedUrl } from "../../../supabase/functions/_shared/gateway";
import {
  doseSpotAdapter, healthGorillaAdapter, healthGorillaIframeGate, healthGorillaResultCorrelation,
  stediAdapter, stediProductionGate,
} from "../../../supabase/functions/_shared/vendorAdapters";
import { PRODUCTION_READINESS_PASS, VENDORS, type OnboardingRow } from "../../../supabase/functions/_shared/vendors";

/**
 * Documented-endpoint mapping gate. Mocked transport only: no network call, no
 * real credential and no PHI. Proves that only officially documented Stedi and
 * Health Gorilla operations are reachable, that everything else fails closed,
 * and that raw X12 and OAuth tokens never escape the server boundary.
 */

const SECRETS: Record<string, string> = {
  STEDI_TEST_API_KEY: "test-key-value",
  STEDI_PROD_API_KEY: "prod-key-value",
  HEALTH_GORILLA_SANDBOX_CLIENT_ID: "hg-client",
  HEALTH_GORILLA_SANDBOX_CLIENT_SECRET: "hg-secret",
};

const row = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({
  id: "r", hospital_id: "h", vendor_key: "stedi", environment: "sandbox",
  state: "sandbox_configured",
  capabilities: { eligibility_270_271: true },
  secret_ref_names: VENDORS.stedi.secretRefs.sandbox,
  last_test_result: "passed",
  evidence_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  ...over,
});

const hgRow = (over: Partial<OnboardingRow> = {}): OnboardingRow => row({
  vendor_key: "health_gorilla",
  capabilities: { diagnostic_report: true },
  secret_ref_names: VENDORS.health_gorilla.secretRefs.sandbox,
  ...over,
});

const op = (o: Partial<Parameters<typeof stediAdapter.execute>[1]>) => ({
  capability: "eligibility_270_271", correlationId: "corr-1", idempotencyKey: "idem-1", ...o,
} as Parameters<typeof stediAdapter.execute>[1]);

type Captured = { url: string; init: RequestInit };
let calls: Captured[];

function mockFetch(responder: (c: Captured) => { status?: number; body?: unknown }) {
  calls = [];
  vi.stubGlobal("fetch", (url: URL | string, init: RequestInit = {}) => {
    const captured = { url: String(url), init };
    calls.push(captured);
    const { status = 200, body = {} } = responder(captured);
    return Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { "content-type": "application/json" },
    }));
  });
}

beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => SECRETS[k] } });
});
afterEach(() => vi.unstubAllGlobals());

describe("documented operation catalog", () => {
  const expected: Array<[string, string, string, string]> = [
    ["stedi_eligibility_check", "POST", "healthcare.us.stedi.com", "/2024-04-01/change/medicalnetwork/eligibility/v3"],
    ["stedi_professional_claim_submit", "POST", "healthcare.us.stedi.com", "/2024-04-01/change/medicalnetwork/professionalclaims/v3/submission"],
    ["stedi_claim_status", "POST", "healthcare.us.stedi.com", "/2024-04-01/change/medicalnetwork/claimstatus/v2"],
    ["stedi_payer_search", "GET", "healthcare.us.stedi.com", "/2024-04-01/payers/search"],
    ["stedi_enrollment_create", "POST", "enrollments.us.stedi.com", "/2024-09-01/enrollments"],
    ["stedi_claim_attachment_upload", "POST", "claims.us.stedi.com", "/2025-03-07/claim-attachments/file"],
    ["hg_oauth_token", "POST", "sandbox.healthgorilla.com", "/oauth/token"],
    ["hg_metadata", "GET", "sandbox.healthgorilla.com", "/fhir/R4/metadata"],
    ["hg_request_group_create", "POST", "sandbox.healthgorilla.com", "/fhir/R4/RequestGroup"],
    ["hg_diagnostic_report_search", "GET", "sandbox.healthgorilla.com", "/fhir/R4/DiagnosticReport"],
    ["hg_observation_search", "GET", "sandbox.healthgorilla.com", "/fhir/R4/Observation"],
    ["hg_binary_read", "GET", "sandbox.healthgorilla.com", "/fhir/R4/Binary/abc-123"],
  ];

  it.each(expected)("%s maps to the exact documented method, host and path", (key, method, host, pathname) => {
    const def = VENDOR_OPERATIONS[key];
    expect(def.method).toBe(method);
    const url = new URL(buildOperationUrl(key, "sandbox", {
      params: { transactionId: "3f1e0b4a-9c1d-4b2e-8f6a-1d2c3b4a5e6f", id: "abc-123" },
      capabilities: { beta_attachment_275: true, org_discovery_provisioned: true, aoe_workflow_provisioned: true },
    }));
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe(host);
    expect(url.pathname).toBe(pathname);
  });

  it("versioned report routes interpolate only a valid UUID transaction id", () => {
    const id = "3f1e0b4a-9c1d-4b2e-8f6a-1d2c3b4a5e6f";
    for (const [key, suffix] of [["stedi_report_277", "/277"], ["stedi_report_835", "/835"]] as const) {
      expect(buildOperationUrl(key, "production", { params: { transactionId: id } }))
        .toBe(`https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/reports/v2/${id}${suffix}`);
    }
    for (const bad of ["../../admin", "not-a-uuid", "3f1e0b4a9c1d4b2e8f6a1d2c3b4a5e6f", ""]) {
      expect(() => buildOperationUrl("stedi_report_277", "sandbox", { params: { transactionId: bad } }))
        .toThrow(OperationError);
    }
  });

  it("rejects undocumented operations, path traversal and unapproved query keys", () => {
    expect(() => buildOperationUrl("stedi_secret_backdoor", "sandbox")).toThrow(/operation_not_documented/);
    expect(() => buildOperationUrl("hg_binary_read", "sandbox", { params: { id: "../../etc/passwd" } }))
      .toThrow(/invalid_path_parameter/);
    expect(() => buildOperationUrl("hg_request_group_search", "sandbox", { query: { _include: "*" } }))
      .toThrow(/query_parameter_not_allowed/);
    expect(() => buildOperationUrl("stedi_payer_search", "sandbox", { query: { apiKey: "x" } }))
      .toThrow(/query_parameter_not_allowed/);
  });

  it("server-controlled query pairs cannot be overridden by a caller", () => {
    const url = new URL(buildOperationUrl("hg_document_reference_search", "sandbox", {
      params: {}, query: { subject: "Patient/abc" },
    }));
    expect(url.searchParams.get("category")).toBe("laboratory");
    expect(url.searchParams.get("subject")).toBe("Patient/abc");
    expect(() => buildOperationUrl("hg_document_reference_search", "sandbox", { query: { category: "note" } }))
      .toThrow(/query_parameter_not_allowed/);
  });

  it("275 attachments stay disabled unless the beta capability is explicitly provisioned", () => {
    expect(VENDOR_OPERATIONS.stedi_claim_attachment_upload.beta).toBe(true);
    expect(() => buildOperationUrl("stedi_claim_attachment_upload", "sandbox")).toThrow(/beta_capability_disabled/);
    expect(() => buildOperationUrl("stedi_claim_attachment_upload", "sandbox", { capabilities: { beta_attachment_275: false } }))
      .toThrow(/beta_capability_disabled/);
    expect(buildOperationUrl("stedi_claim_attachment_upload", "sandbox", { capabilities: { beta_attachment_275: true } }))
      .toBe("https://claims.us.stedi.com/2025-03-07/claim-attachments/file");
  });

  it("discovery and AOE workflows require tenant provisioning", () => {
    for (const key of ["hg_organization_search", "hg_questionnaire_search", "hg_service_request_read"]) {
      expect(() => buildOperationUrl(key, "sandbox", { params: { id: "abc" } })).toThrow(/capability_not_provisioned/);
    }
    expect(new URL(buildOperationUrl("hg_organization_search", "sandbox", { capabilities: { org_discovery_provisioned: true } }))
      .searchParams.get("ordering-enabled")).toBe("true");
  });

  it("production Health Gorilla operations use the production FHIR base only", () => {
    expect(buildOperationUrl("hg_metadata", "production")).toBe("https://api.healthgorilla.com/fhir/R4/metadata");
    expect(HEALTH_GORILLA_TOKEN_URL).toEqual({
      sandbox: "https://sandbox.healthgorilla.com/oauth/token",
      production: "https://api.healthgorilla.com/oauth/token",
    });
  });

  it("every catalog URL survives the gateway host allowlist", () => {
    for (const [key, def] of Object.entries(VENDOR_OPERATIONS)) {
      for (const env of ["sandbox", "production"] as const) {
        const url = buildOperationUrl(key, env, {
          params: { transactionId: "3f1e0b4a-9c1d-4b2e-8f6a-1d2c3b4a5e6f", id: "abc" },
          capabilities: { beta_attachment_275: true, org_discovery_provisioned: true, aoe_workflow_provisioned: true },
        });
        expect(() => assertAllowedUrl(def.vendor, env, url), `${key}:${env}`).not.toThrow();
      }
    }
  });
});

describe("Stedi transport (mocked)", () => {
  it("calls the documented route with a server-set Idempotency-Key and server-only API key", async () => {
    mockFetch(() => ({ body: { transactionId: "t", status: "ACCEPTED" } }));
    const res = await stediAdapter.execute(row(), op({ operation: "stedi_eligibility_check" }));
    expect(res.status).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Key test-key-value");
    expect(headers["Idempotency-Key"]).toBe("idem-1");
    // only the replay reference is returned for persistence — never the key
    expect(res.idempotencyKey).toBe("idem-1");
    expect(JSON.stringify(res)).not.toContain("test-key-value");
  });

  it("strips raw X12 from anything returned for persistence or logging", async () => {
    mockFetch(() => ({ body: { status: "ACCEPTED", x12: "ISA*00*...~", meta: { rawX12: "GS*HB*..." }, controlNumber: "000000001" } }));
    const res = await stediAdapter.execute(row(), op({ operation: "stedi_eligibility_check" }));
    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toMatch(/ISA\*/);
    expect(serialized).not.toMatch(/GS\*/);
    expect(res.data).toEqual({ status: "ACCEPTED", meta: {}, controlNumber: "000000001" });
    expect(stripX12({ a: [{ x12: "x", b: 1 }] })).toEqual({ a: [{ b: 1 }] });
  });

  it("surfaces 409/422 as terminal vendor decisions without blind retries", async () => {
    for (const status of [409, 422]) {
      mockFetch(() => ({ status, body: { error: "duplicate" } }));
      const res = await stediAdapter.execute(row(), op({ operation: "stedi_eligibility_check" }));
      expect(res.status).toBe("blocked");
      expect(res.reason).toBe(`vendor_status_${status}`);
      expect(calls).toHaveLength(1);
    }
  });

  it("refuses a redirect toward an unlisted host instead of following it", async () => {
    mockFetch(() => ({ status: 302, body: {} }));
    const res = await stediAdapter.execute(row(), op({ operation: "stedi_eligibility_check" }));
    expect(res).toEqual({ status: "unavailable", reason: "redirect_refused" });
  });

  it("refuses an operation that does not match the requested capability or vendor", async () => {
    mockFetch(() => ({ body: {} }));
    expect(await stediAdapter.execute(row(), op({ operation: "stedi_claim_status" })))
      .toEqual({ status: "unavailable", reason: "capability_mismatch" });
    expect(await stediAdapter.execute(row(), op({ operation: "hg_metadata" })))
      .toEqual({ status: "unavailable", reason: "operation_not_documented" });
    expect(calls).toHaveLength(0);
  });

  it("production needs the exact provider/payer transaction enrollment on top of onboarding", () => {
    const prod = row({
      environment: "production", state: "production_verified",
      secret_ref_names: VENDORS.stedi.secretRefs.production,
      capabilities: { claim_837p: true, baa_verified: true, mfa_enforced: true },
      last_test_result: PRODUCTION_READINESS_PASS,
    });
    const target = { capability: "claim_837p", transaction: "837P", providerNpi: "1234567893", payerId: "60054" };
    expect(stediProductionGate(prod, target, [])).toBe("payer_transaction_enrollment_inactive");
    expect(stediProductionGate(prod, target, [{ transaction: "837P", status: "pending", provider_npi: "1234567893", payer_id: "60054" }]))
      .toBe("payer_transaction_enrollment_inactive");
    expect(stediProductionGate(prod, target, [{ transaction: "837P", status: "active", provider_npi: "9999999999", payer_id: "60054" }]))
      .toBe("payer_transaction_enrollment_inactive");
    expect(stediProductionGate(prod, target, [{ transaction: "837P", status: "active", provider_npi: "1234567893", payer_id: "60054" }]))
      .toBeNull();
    expect(stediProductionGate({ ...prod, last_test_result: "passed" }, target, []))
      .toBe("production_readiness_test_missing");
  });
});

describe("Health Gorilla transport (mocked)", () => {
  const hgOp = op({ capability: "diagnostic_report", operation: "hg_diagnostic_report_search", query: { "based-on": "RequestGroup/abc-123" } });

  it("obtains a form-encoded client-credentials token and keeps it in server memory only", async () => {
    mockFetch((c) => c.url.includes("/oauth/token")
      ? { body: { access_token: "hg-access-token", expires_in: 300 } }
      : { body: { resourceType: "Bundle", entry: [] } });

    const res = await healthGorillaAdapter.execute(hgRow(), hgOp);
    expect(res.status).toBe("ok");

    const [token, fhir] = calls;
    expect(token.url).toBe("https://sandbox.healthgorilla.com/oauth/token");
    expect((token.init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(String(token.init.body)).toContain("grant_type=client_credentials");
    expect((fhir.init.headers as Record<string, string>).Authorization).toBe("Bearer hg-access-token");
    expect(fhir.url).toBe("https://sandbox.healthgorilla.com/fhir/R4/DiagnosticReport?based-on=RequestGroup%2Fabc-123");

    // the token never reaches anything persistable, loggable or client-visible
    expect(JSON.stringify(res)).not.toContain("hg-access-token");
    expect(JSON.stringify(res)).not.toContain("hg-secret");
  });

  it("fails closed when OAuth is not provisioned", async () => {
    mockFetch(() => ({ status: 401, body: { error: "invalid_client" } }));
    const res = await healthGorillaAdapter.execute(hgRow({ hospital_id: "h2" }), hgOp);
    expect(res).toEqual({ status: "unavailable", reason: "oauth_not_provisioned" });
  });

  it("iframe/session launch stays partner-gated", () => {
    expect(healthGorillaIframeGate(hgRow({ capabilities: { iframe_ordering: true } })))
      .toBe("iframe_session_contract_not_provisioned");
    expect(healthGorillaIframeGate(null)).toBe("no_vendor_profile");
  });

  it("never auto-imports an unmatched, cross-facility or mis-correlated result", () => {
    const order = { id: "o1", patient_id: "p1", hospital_id: "h1" };
    expect(healthGorillaResultCorrelation({ basedOnOrderId: "o1", patientId: "p1" }, null, "h1").reason)
      .toBe("unmatched_order_staged_only");
    expect(healthGorillaResultCorrelation({ basedOnOrderId: "o1", patientId: "p1" }, order, "h2").reason)
      .toBe("facility_mismatch");
    expect(healthGorillaResultCorrelation({ basedOnOrderId: "o2", patientId: "p1" }, order, "h1").reason)
      .toBe("order_correlation_mismatch");
    expect(healthGorillaResultCorrelation({ basedOnOrderId: "o1", patientId: "p9" }, order, "h1").reason)
      .toBe("patient_correlation_mismatch");
    expect(healthGorillaResultCorrelation({ basedOnOrderId: "o1", patientId: "p1" }, order, "h1").accepted).toBe(true);
  });
});

describe("DoseSpot stays closed", () => {
  it("has no assumed host and never transmits without the private partner package", async () => {
    expect(VENDORS.dosespot.hosts).toEqual({ sandbox: [], production: [] });
    mockFetch(() => ({ body: {} }));
    const res = await doseSpotAdapter.execute(row({
      vendor_key: "dosespot", capabilities: { new_rx: true },
      secret_ref_names: VENDORS.dosespot.secretRefs.sandbox,
    }), op({ capability: "new_rx", operation: "stedi_eligibility_check" }));
    expect(res).toEqual({ status: "blocked", reason: "vendor_contract_document_required" });
    expect(calls).toHaveLength(0);
    expect(Object.keys(VENDOR_OPERATIONS).some((k) => k.startsWith("dosespot"))).toBe(false);
  });
});
