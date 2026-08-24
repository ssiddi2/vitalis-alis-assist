import { describe, expect, it } from "vitest";
import {
  buildLaunch, JUMPSTART_LAUNCH_BLOCKER, launchContractRecorded, launchReadiness,
} from "../../../supabase/functions/_shared/dosespot";
import { doseSpotPrescribingGate } from "../../../supabase/functions/_shared/vendorAdapters";
import type { OnboardingRow } from "../../../supabase/functions/_shared/vendors";

const row = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({
  id: "r", hospital_id: "h", vendor_key: "dosespot", environment: "production",
  state: "production_verified",
  capabilities: { new_rx: true, baa_verified: true, mfa_enforced: true, dosespot_rest: { any: true } },
  secret_ref_names: ["DOSESPOT_PROD_CLIENT_ID_REF", "DOSESPOT_PROD_CLIENT_SECRET_REF", "DOSESPOT_PROD_CLINIC_ID_REF"],
  last_test_result: "production_readiness_passed",
  evidence_expires_at: new Date(Date.now() + 8.64e7).toISOString(),
  ...over,
});

describe("Jumpstart embedded launch has no vendor contract", () => {
  it("never returns a URL, even for a fully eligible production facility", async () => {
    const res = await buildLaunch(row(), { clinicId: "1", clinicianId: "2" }, { controlled: false });
    expect(res).toEqual({ status: "unavailable", reason: JUMPSTART_LAUNCH_BLOCKER });
    expect(JSON.stringify(res)).not.toMatch(/https:|secret|token|signature/i);
  });

  it("still surfaces the real prescribing blocker before the missing launch contract", async () => {
    for (const r of [null, row({ state: "sandbox_pending", environment: "sandbox" }), row({ evidence_expires_at: null })]) {
      const res = await buildLaunch(r, { clinicId: "1", clinicianId: "2" }, { controlled: false });
      expect(res.status).toBe("blocked");
      expect(JSON.stringify(res)).not.toMatch(/secret|token|SECRET/i);
    }
  });

  it("stays unavailable even when a launch contract reference is recorded but unapproved", () => {
    expect(launchContractRecorded(row())).toBe(false);
    expect(launchContractRecorded(row({
      capabilities: { jumpstart_launch_contract: { evidence_ref: "x", approved: false } },
    }))).toBe(false);
    expect(launchContractRecorded(row({
      capabilities: { jumpstart_launch_contract: { evidence_ref: "x", approved: true } },
    }))).toBe(true);
  });

  it("blocks controlled prescribing separately from non-controlled", () => {
    const epcsRow = row({ capabilities: { ...row().capabilities, epcs: true } });
    expect(doseSpotPrescribingGate(epcsRow, true)).toBeTruthy();
    expect(doseSpotPrescribingGate(row({ capabilities: {} }), false)).toBe("capability_not_enabled");
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
