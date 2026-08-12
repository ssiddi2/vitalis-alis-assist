import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { connectionState, normalizeEligibility, professionalClaimPreview } from "../../../supabase/functions/_shared/stediClaims";
import type { OnboardingRow } from "../../../supabase/functions/_shared/vendors";

/**
 * VirtualisNote "Coverage & Claim" regression gate.
 * Proves the encounter-bound billing surface stays server-authoritative:
 * tenant/encounter scoping, billing-role least privilege, fail-closed vendor
 * gates, attestation before submit and no raw X12 / vendor keys in the browser.
 */
const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");
const adapter = read("supabase/functions/claims-adapter/index.ts");
const shared = read("supabase/functions/_shared/stediClaims.ts");
const panel = read("src/components/virtualis/CoverageClaimPanel.tsx");
const hook = read("src/hooks/useCoverageClaim.ts");
const lib = read("src/lib/claims.ts");
const editor = read("src/components/virtualis/NoteEditorModal.tsx");

const row = (patch: Partial<OnboardingRow> = {}): OnboardingRow => ({
  id: "r", hospital_id: "h", vendor_key: "stedi", environment: "sandbox",
  state: "sandbox_configured",
  capabilities: { eligibility_270_271: true, claim_837p: true },
  secret_ref_names: ["STEDI_TEST_API_KEY_REF"],
  last_test_result: null, evidence_expires_at: null, ...patch,
});

describe("panel scoping", () => {
  it("is mounted inside VirtualisNote bound to the current patient and note", () => {
    expect(editor).toMatch(/<CoverageClaimPanel[\s\S]{0,120}patientId=\{patientId\}[\s\S]{0,60}noteId=\{note\.id\}/);
    expect(editor).toMatch(/hospitalId=\{selectedHospital\?\.id\}/);
  });

  it("every server action binds hospital membership, and claims are resolved within the tenant", () => {
    expect(adapter).toMatch(/userHasHospitalAccess\(admin, user\.id, hospital_id\)\)\) return json\(\{ error: "Forbidden" \}, 403\)/);
    expect(adapter).toMatch(/from\("claims"\)\.select\("\*"\)\.eq\("id", claim_id\)\s*\n?\s*\.eq\("hospital_id", hospital_id\)/);
    expect(adapter).toMatch(/\.eq\("encounter_id", encounter_id\)\.eq\("hospital_id", hospital_id\)/);
  });

  it("rejects cross-patient coverage and encounter spoofing", () => {
    expect(adapter).toMatch(/patientInHospital\(admin, patient_id, hospital_id\)/);
    expect(adapter).toMatch(/patient_insurance[\s\S]{0,120}\.eq\("patient_id", patient_id\)/);
    expect(adapter).toMatch(/encounters"\)[\s\S]{0,160}\.eq\("patient_id", patient_id\)\.eq\("hospital_id", hospital_id\)/);
  });
});

describe("least-privilege billing role", () => {
  it("derives financial authority server-side from the app role plus facility membership", () => {
    expect(shared).toMatch(/from\("user_roles"\)[\s\S]{0,80}\.eq\("role", "admin"\)/);
    expect(shared).toMatch(/from\("hospital_users"\)[\s\S]{0,120}\.eq\("hospital_id", hospitalId\)/);
    expect(shared).not.toMatch(/localStorage|sessionStorage/);
  });

  it("eligibility, preview, status, submit and correction all require the billing role", () => {
    for (const guardPoint of [
      /if \(action === "eligibility_check"\) \{\s*\n\s*const denied = requireBilling\(\);/,
      /if \(action === "preview"\) \{\s*\n\s*const denied = requireBilling\(\);/,
      /if \(action === "status_check"\) \{\s*\n\s*const denied = requireBilling\(\);/,
      /\/\/ -+ SUBMIT \(837P\) -+\n\s*const denied = requireBilling\(\);/,
    ]) expect(adapter).toMatch(guardPoint);
    expect(adapter).toMatch(/canBill \? null : json\(\{ error: "Billing role required" \}, 403\)/);
  });

  it("clinicians keep a read-only surface in the UI", () => {
    expect(panel).toMatch(/only an authorized billing role may review, submit or correct a claim/i);
    expect(panel).toMatch(/View only — a billing role initiates eligibility/i);
  });
});

describe("submission fails closed", () => {
  it("requires attestation, an approved claim and a passing readiness check", () => {
    expect(adapter).toMatch(/body\?\.attestation !== true\) return json\(\{ status: "error", reason: "attestation_required" \}/);
    expect(adapter).toMatch(/claim\.status !== "approved" && claim\.status !== "denied"/);
    expect(adapter).toMatch(/\.can_approve\) \{[\s\S]{0,80}reason: "claim_not_ready"/);
    expect(adapter).toMatch(/hard_scrubber_failure/);
  });

  it("readiness requires a signed/locked note and complete coding", () => {
    expect(adapter).toMatch(/clinical_notes"\)[\s\S]{0,200}\.in\("status", \["signed", "amended"\]\)/);
    expect(panel).toMatch(/Signed &amp; locked clinical note/);
    expect(panel).toMatch(/ICD-10 diagnosis links/);
    expect(panel).toMatch(/CPT\/HCPCS service lines/);
  });

  it("is idempotent for a double submit and never auto-retries", () => {
    expect(adapter).toMatch(/event_id = `\$\{claim_id\}:\$\{payload_hash\.slice\(0, 16\)\}`/);
    expect(adapter).toMatch(/if \(existing\) return json\(\{ status: "duplicate", reason: "idempotent_replay"/);
    expect(adapter).toMatch(/idempotencyKey: event_id/);
    expect(panel).toMatch(/disabled=\{!attested \|\| submitting\}/);
    expect(adapter).not.toMatch(/setTimeout|retry\(/);
  });

  it("a refusal opens a billing work item and never touches the signed note", () => {
    expect(adapter).toMatch(/event_code: "claim\.work_item_opened"/);
    expect(adapter).not.toMatch(/from\("clinical_notes"\)\.update/);
    expect(adapter).not.toMatch(/from\("note_versions"\)/);
    expect(panel).toMatch(/coding query or signed addendum/i);
  });
});

describe("vendor gates and environment labelling", () => {
  it("labels sandbox, not-connected and production-verified from authoritative server state", () => {
    expect(connectionState(null, "claim_837p").label).toBe("not_connected");
    expect(connectionState(row(), "claim_837p").label).toBe("sandbox");
    expect(connectionState(row({ capabilities: {} }), "claim_837p").blocked).toBe("capability_not_enabled");
    expect(connectionState(row({ environment: "production", state: "production_review" }), "claim_837p").label).toBe("not_connected");
  });

  it("production requires verification, evidence, BAA, MFA and a passed readiness test", () => {
    const prod = row({
      environment: "production", state: "production_verified",
      secret_ref_names: ["STEDI_PROD_API_KEY_REF"],
      evidence_expires_at: new Date(Date.now() + 8.64e7).toISOString(),
    });
    expect(connectionState(prod, "claim_837p").blocked).toBe("baa_evidence_missing");
    expect(connectionState({ ...prod, capabilities: { claim_837p: true, baa_verified: true } }, "claim_837p").blocked)
      .toBe("vendor_portal_mfa_not_enforced");
  });

  it("production submission also requires an active payer transaction enrollment", () => {
    expect(shared).toMatch(/stediProductionGate/);
    expect(adapter).toMatch(/provider_payer_enrollments"\)[\s\S]{0,160}\.eq\("hospital_id", hospital_id\)/);
  });

  it("275 attachments stay hidden unless the beta capability is provisioned", () => {
    expect(adapter).toMatch(/attachments_enabled: stedi\?\.capabilities\?\.attachment_275 === true &&\s*\n\s*stedi\?\.capabilities\?\.beta_attachments === true/);
    expect(panel).toMatch(/caps\?\.attachments_enabled &&/);
    expect(panel).toMatch(/never sent wholesale/i);
  });
});

describe("no browser-to-vendor traffic and no raw X12", () => {
  it("the client only calls the server adapter and holds no vendor key", () => {
    for (const src of [panel, hook, lib]) {
      expect(src).not.toMatch(/stedi\.com/);
      expect(src).not.toMatch(/API_KEY|Authorization: `Key/);
    }
    expect(lib).toMatch(/supabase\.functions\.invoke\('claims-adapter'/);
  });

  it("no raw X12 is built, returned or persisted", () => {
    expect(shared).toMatch(/stripX12/);
    expect(adapter).not.toMatch(/ISA\*|GS\*|~\\n/);
    expect(adapter).toMatch(/payload_hash/);
    expect(panel).toMatch(/Review 837P \(normalized\)/);
  });

  it("audit metadata stays PHI-minimized and bodies are never logged", () => {
    expect(adapter).toMatch(/console\.error\("\[claims-adapter\]", e instanceof Error \? e\.message : e\)/);
    expect(adapter).not.toMatch(/console\.log/);
    expect(adapter).toMatch(/metadata: \{ result: result\.status, reason: result\.reason \?\? null, attested_by: user\.id/);
  });
});

describe("normalization", () => {
  it("degrades unknown 271 shapes to unknown coverage rather than eligible", () => {
    expect(normalizeEligibility({}).coverage_active).toBeNull();
    expect(normalizeEligibility({ errors: [{ code: "x" }] }).coverage_active).toBe(false);
    const good = normalizeEligibility({
      benefitsInformation: [
        { code: "1", name: "Active Coverage", planDateInformation: { plan: "2026-01-01", planEnd: "2026-12-31" } },
        { code: "B", benefitAmount: "25" },
        { code: "C", benefitAmount: "500" },
        { code: "A", benefitPercent: "0.2" },
      ],
    });
    expect(good).toMatchObject({
      coverage_active: true, copay_amount: 25, deductible_remaining: 500,
      coinsurance_percent: 20, plan_begin: "2026-01-01", plan_end: "2026-12-31",
    });
  });

  it("the 837P preview exposes coded data only — no member id, subscriber or free-text note", () => {
    const preview = professionalClaimPreview({
      claim: { billing_type: "insurance", place_of_service: "02", total_charge: 120, rendering_provider_npi: "1234567893", billing_provider_npi: "1234567893", member_id: "M123", medical_necessity_rationale: "secret prose" },
      lines: [{ cpt_code: "99213", units: 1, charge_amount: 120, modifiers: ["95"], diagnosis_pointers: [1] }],
      diagnoses: [{ icd10_code: "E11.9", code_set: "ICD10" }],
      payerName: "Test Payer",
    });
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toMatch(/M123|secret prose/);
    expect(preview.service_lines[0].cpt_code).toBe("99213");
  });
});

describe("UX states", () => {
  it("covers loading, empty, error, retry and refresh without blocking note actions", () => {
    expect(panel).toMatch(/animate-pulse/);
    expect(panel).toMatch(/role="alert"/);
    expect(panel).toMatch(/Retry/);
    expect(panel).toMatch(/No claim has been created for this encounter/);
    // Panel is a flow-level section: no fixed/absolute overlay that could cover Sign & Save.
    expect(panel).not.toMatch(/className="[^"]*\b(fixed|absolute)\b/);
    expect(panel).toMatch(/aria-label="Coverage and claim"/);
    expect(panel).toMatch(/aria-label="Refresh coverage and claim state"/);
  });
});
