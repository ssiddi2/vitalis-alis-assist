import { describe, expect, it } from "vitest";
import { buildLaunch, launchReadiness, partnerConfig } from "../../../supabase/functions/_shared/dosespot";
import { doseSpotPrescribingGate } from "../../../supabase/functions/_shared/vendorAdapters";
import type { OnboardingRow } from "../../../supabase/functions/_shared/vendors";

const row = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({
  id: "r", hospital_id: "h", vendor_key: "dosespot", environment: "production",
  state: "production_verified", capabilities: { new_rx: true, baa_verified: true, mfa_enforced: true },
  secret_ref_names: ["DOSESPOT_PROD_CLIENT_ID_REF", "DOSESPOT_PROD_CLIENT_SECRET_REF", "DOSESPOT_PROD_CLINIC_ID_REF"],
  last_test_result: "production_readiness_passed",
  evidence_expires_at: new Date(Date.now() + 8.64e7).toISOString(),
  ...over,
});

describe("DoseSpot partner configuration", () => {
  it("requires an uploaded partner package", () => {
    expect(partnerConfig(null)).toEqual({ reason: "no_vendor_profile" });
    expect(partnerConfig(row())).toEqual({ reason: "vendor_partner_package_required" });
  });

  it("rejects a malformed or unsigned partner config", () => {
    expect(partnerConfig(row({ capabilities: { partner_config: { host: "x" } } })))
      .toEqual({ reason: "partner_config_invalid" });
    const valid = {
      host: "partner.example.com", launchPath: "/launch/{clinicId}", launchTtlSeconds: 120,
      paramNames: { clinicId: "c", clinicianId: "u" }, signing: null,
    };
    expect(partnerConfig(row({ capabilities: { partner_config: valid } })))
      .toEqual({ reason: "launch_signing_rule_not_configured" });
  });
});

describe("launch boundary fails closed", () => {
  it("blocks when vendor evidence is missing and never returns a URL", async () => {
    for (const r of [null, row({ state: "sandbox_pending", environment: "sandbox" }), row({ evidence_expires_at: null })]) {
      const res = await buildLaunch(r, { clinicId: "1", clinicianId: "2" }, { controlled: false });
      expect(res.status).not.toBe("ok");
      expect(JSON.stringify(res)).not.toMatch(/secret|token|SECRET/i);
    }
  });

  it("blocks controlled prescribing separately from non-controlled", () => {
    const epcsRow = row({ capabilities: { ...row().capabilities, epcs: true } });
    expect(doseSpotPrescribingGate(epcsRow, true)).toBeTruthy();
    expect(doseSpotPrescribingGate(row({ capabilities: {} }), false)).toBe("capability_not_enabled");
  });

  it("never proceeds without provisioned secret references", async () => {
    const res = await buildLaunch(row({ secret_ref_names: [] }), { clinicId: "1", clinicianId: "2" }, { controlled: false });
    expect(res).toEqual({ status: "blocked", reason: "secret_references_missing" });
  });
});

describe("pre-launch synchronization", () => {
  const ok = {
    demographicsComplete: true, allergyReviewed: true, medRecCompleted: true,
    prescriberNpi: "1234567893", prescriberStateAuthorized: true, encounterActive: true,
    patientMapped: true, prescriberMapped: true, clinicMapped: true,
  };
  it("passes only when every minimum-necessary element is current", () => {
    expect(launchReadiness(ok)).toEqual([]);
    expect(launchReadiness({ ...ok, medRecCompleted: false })).toContain("medication_reconciliation_missing");
    expect(launchReadiness({ ...ok, prescriberNpi: null })).toContain("prescriber_npi_missing");
    expect(launchReadiness({ ...ok, patientMapped: false })).toContain("patient_identifier_not_mapped");
    expect(launchReadiness({ ...ok, encounterActive: false })).toContain("no_active_encounter");
  });
});
