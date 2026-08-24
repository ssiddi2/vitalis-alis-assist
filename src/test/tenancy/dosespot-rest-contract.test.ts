import { describe, it, expect, vi } from "vitest";
import {
  DOSESPOT_ROUTES,
  REST_NEW_RX_SUPPORTED,
  SENSITIVE_DENYLIST,
  isDeniedPath,
  buildRestUrl,
  restCall,
  RestUrlError,
  type DoseSpotRestConfig,
} from "../../../supabase/functions/_shared/dosespotRest";

const routes = DOSESPOT_ROUTES as Record<string, { method: string; path: string; requires?: string }>;

const config: DoseSpotRestConfig = {
  baseUrl: "https://sandbox.example-dosespot.test/",
  hostAllowlist: ["sandbox.example-dosespot.test"],
  authMode: "jwt_bearer_subscription_key",
  secretRefNames: {
    clinicId: "DOSESPOT_SANDBOX_CLINIC_ID",
    userId: "DOSESPOT_SANDBOX_USER_ID",
    clinicKey: "DOSESPOT_SANDBOX_CLINIC_KEY",
    subscriptionKey: "DOSESPOT_SANDBOX_SUBSCRIPTION_KEY",
  },
  restGuide: { evidenceRef: "ref", sha256: "x", approved: true },
  authGuide: null,
};

describe("DoseSpot REST V2 route registry matches the guide headings", () => {
  const expected: Record<string, [string, string]> = {
    general_check: ["GET", "api/general/check"],
    clinician_get: ["GET", "api/clinicians/{clinicianId}"],
    clinician_registration_status: ["GET", "api/clinicians/{clinicianId}/registrationStatus"],
    clinician_legal_agreements: ["GET", "api/clinicians/{clinicianId}/legalAgreements"],
    clinician_dea_get: ["GET", "api/clinicians/{clinicianId}/deanumber"],
    patient_get: ["GET", "api/patients/{patientId}"],
    patient_search: ["GET", "api/patients/search"],
    patient_create: ["POST", "api/patients"],
    patient_update: ["PUT", "api/patients/{patientId}"],
    patient_clinics: ["GET", "api/patients/{patientId}/clinics"],
    patient_clinicians: ["GET", "api/patients/{patientId}/clinicians"],
    patient_pharmacies: ["GET", "api/patients/{patientId}/pharmacies"],
    patient_allergies_list: ["GET", "api/patients/{patientId}/allergies"],
    patient_allergy_create_coded: ["POST", "api/patients/{patientId}/allergies/coded"],
    patient_allergy_create_freetext: ["POST", "api/patients/{patientId}/allergies/freetext"],
    patient_allergy_update: ["PUT", "api/patients/{patientId}/allergies/{patientAllergyId}"],
    patient_no_known_allergy: ["POST", "api/patients/{patientId}/allergies/noKnownAllergy"],
    patient_medication_history: ["GET", "api/patients/{patientId}/medications/history"],
    patient_medication_history_consent: ["POST", "api/patients/{patientId}/medications/history/consent"],
    patient_prescriptions: ["GET", "api/patients/{patientId}/prescriptions"],
    prescription_get: ["GET", "api/patients/{patientId}/prescriptions/{prescriptionId}"],
    prescription_log: ["GET", "api/patients/{patientId}/prescriptions/{prescriptionId}/log"],
    notification_counts: ["GET", "api/notifications/counts"],
    notification_errors: ["GET", "api/notifications/errors"],
    refill_requests_pending: ["GET", "api/refills/pending"],
    refill_requests_pending_detailed: ["GET", "api/refills/pending/detailed"],
    rxchange_requests_pending: ["GET", "api/rxchanges/pending"],
    rxchange_requests_pending_detailed: ["GET", "api/rxchanges/pending/detailed"],
  };

  it("contains exactly the documented subset", () => {
    expect(Object.keys(routes).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [key, [method, path]] of Object.entries(expected)) {
    it(`${key} is ${method} ${path}`, () => {
      expect([routes[key].method, routes[key].path]).toEqual([method, path]);
    });
  }

  it("has no plain GET api/patients list route", () => {
    expect(Object.values(routes).some((r) => r.method === "GET" && r.path === "api/patients")).toBe(false);
  });

  it("has no invented refillRequests/rxChangeRequests routes", () => {
    expect(Object.values(routes).some((r) => /refillRequests|rxChangeRequests/.test(r.path))).toBe(false);
  });
});

describe("consent precondition", () => {
  it("applies only to the medication-history GET", () => {
    const withRequires = Object.entries(routes).filter(([, r]) => r.requires);
    expect(withRequires.map(([k]) => k)).toEqual(["patient_medication_history"]);
    expect(routes.patient_medication_history.requires).toBe("accepted_current_med_history_consent");
  });

  it("does not gate the consent POST on an existing consent", () => {
    expect(routes.patient_medication_history_consent.requires).toBeUndefined();
  });
});

describe("prescription boundary", () => {
  it("declares NewRx unsupported", () => {
    expect(REST_NEW_RX_SUPPORTED).toBe(false);
  });

  it("exposes no NewRx create/send route", () => {
    for (const [key, r] of Object.entries(routes)) {
      expect(/newrx|\bsend\b|sign/i.test(`${key} ${r.path}`)).toBe(false);
      if (/prescription/i.test(r.path)) expect(r.method).toBe("GET");
    }
  });
});

describe("sensitive endpoint denylist", () => {
  for (const term of SENSITIVE_DENYLIST) {
    it(`denies ${term}`, () => {
      expect(isDeniedPath(`api/clinicians/1/${term.replace(/^\//, "")}`)).toBe(true);
    });
  }

  it("keeps denied endpoints out of the registry", () => {
    for (const r of Object.values(routes)) expect(isDeniedPath(r.path)).toBe(false);
  });
});

describe("URL builder", () => {
  it("encodes path parameters", () => {
    const url = buildRestUrl(config, "patient_get", { params: { patientId: "12 3/4" } });
    expect(url).toBe("https://sandbox.example-dosespot.test/api/patients/12%203%2F4");
  });

  it("rejects missing path parameters", () => {
    expect(() => buildRestUrl(config, "patient_get", {})).toThrow(RestUrlError);
  });

  it("enforces the host allowlist", () => {
    expect(() => buildRestUrl({ ...config, hostAllowlist: ["other.test"] }, "general_check"))
      .toThrow(/base_url_not_allowlisted/);
  });
});

describe("restCall performs no transport", () => {
  it("is unavailable pending the separate auth contract", () => {
    expect(restCall(null, "general_check")).toEqual({ status: "unavailable", reason: "no_vendor_profile" });
  });

  it("never returns a success status", () => {
    for (const key of Object.keys(routes)) {
      const res = restCall(null, key as never);
      expect(["unavailable", "blocked"]).toContain(res.status);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Second evidence audit: response wrappers, enum typos, transmission.
 * ------------------------------------------------------------------ */

import {
  clinicianSnapshot,
  parseRegistrationStatus,
  epcsCorroboration,
} from "../../../supabase/functions/_shared/dosespotRest";
import { doseSpotAdapter, DOSESPOT_NEW_RX_BLOCKER } from "../../../supabase/functions/_shared/vendorAdapters";
import { VENDORS, type OnboardingRow } from "../../../supabase/functions/_shared/vendors";

describe("clinician response normalization uses the documented wrappers", () => {
  const clinician = (clinicInfo: unknown[]) => ({
    Item: {
      ClinicianId: 42, Confirmed: true, Active: true, AccountLocked: false, EpcsRequested: true,
      FirstName: "Ada", LastName: "Lovelace", DEANumber: "X1234567", ClinicInfo: clinicInfo,
    },
  });
  const info = (id: number, epcs: boolean) => ({
    ClinicId: id, HasNewRx: true, HasRefills: true, HasRxChange: true,
    HasCancel: true, HasRxFill: true, HasEpcs: epcs,
  });

  it("reads clinician flags from Item and status from the separate response Item", () => {
    const s = clinicianSnapshot(clinician([info(7, true)]), { Item: "TFAActivatedSuccess" });
    expect(s.confirmed).toBe(true);
    expect(s.active).toBe(true);
    expect(s.accountLocked).toBe(false);
    expect(s.epcsRequested).toBe(true);
    expect(s.registrationStatus).toBe("TFAActivatedSuccess");
    expect(s.clinic.hasEpcs).toBe(true);
  });

  it("ignores capability-looking fields on the clinician root", () => {
    const s = clinicianSnapshot(
      { Item: { Confirmed: true, HasEpcs: true, HasNewRx: true, ClinicInfo: [] } },
      { Item: "Pending" },
    );
    expect(s.clinic).toEqual({
      hasNewRx: false, hasRefills: false, hasRxChange: false,
      hasCancel: false, hasRxFill: false, hasEpcs: false,
    });
  });

  it("selects the matching ClinicInfo entry when several exist", () => {
    const s = clinicianSnapshot(clinician([info(7, false), info(9, true)]), { Item: "TFAActivatedSuccess" }, 9);
    expect(s.clinic.hasEpcs).toBe(true);
  });

  it("fails closed on multiple clinics with no exact match", () => {
    for (const selector of [undefined, null, "", 11]) {
      const s = clinicianSnapshot(clinician([info(7, true), info(9, true)]), { Item: "TFAActivatedSuccess" }, selector as never);
      expect(Object.values(s.clinic).every((v) => v === false)).toBe(true);
    }
  });

  it("returns only the normalized snapshot keys", () => {
    const s = clinicianSnapshot(clinician([info(7, true)]), { Item: "TFAActivatedSuccess" }, 7);
    expect(Object.keys(s).sort()).toEqual(
      ["accountLocked", "active", "clinic", "confirmed", "epcsRequested", "registrationStatus"],
    );
    expect(JSON.stringify(s)).not.toMatch(/Lovelace|X1234567|ClinicianId/);
  });

  it("fails closed on a null/empty response", () => {
    const s = clinicianSnapshot(null, null);
    expect(s.registrationStatus).toBe("unknown");
    expect(Object.values(s.clinic).every((v) => v === false)).toBe(true);
  });
});

describe("registration status wire values", () => {
  it("normalizes the two documented typos", () => {
    expect(parseRegistrationStatus("TFAAcitvateInit")).toBe("TFAActivateInit");
    expect(parseRegistrationStatus("TFADectivatedSuccess")).toBe("TFADeactivatedSuccess");
  });

  it("keeps canonical values and rejects anything else", () => {
    expect(parseRegistrationStatus("IDPInitializeSuccess")).toBe("IDPInitializeSuccess");
    for (const v of ["TFAActivated", "", "success", 5, null, undefined, {}]) {
      expect(parseRegistrationStatus(v)).toBe("unknown");
    }
  });

  it("accepts only TFAActivatedSuccess for EPCS corroboration", () => {
    const base = {
      confirmed: true, active: true, accountLocked: false, epcsRequested: true,
      clinic: { hasNewRx: true, hasRefills: true, hasRxChange: true, hasCancel: true, hasRxFill: true, hasEpcs: true },
    };
    expect(epcsCorroboration({ ...base, registrationStatus: "TFAActivatedSuccess" }, true).corroborated).toBe(true);
    for (const s of ["TFAActivateInit", "TFADeactivatedSuccess", "unknown"] as const) {
      expect(epcsCorroboration({ ...base, registrationStatus: s }, true).blockers)
        .toContain("epcs_registration_incomplete");
    }
  });
});

describe("DoseSpot secret references follow the resource guide", () => {
  it("uses Clinic Id / User Id / Clinic Key / Subscription Key per environment", () => {
    expect(VENDORS.dosespot.secretRefs.sandbox).toEqual([
      "DOSESPOT_TEST_CLINIC_ID_REF", "DOSESPOT_TEST_USER_ID_REF",
      "DOSESPOT_TEST_CLINIC_KEY_REF", "DOSESPOT_TEST_SUBSCRIPTION_KEY_REF",
    ]);
    expect(VENDORS.dosespot.secretRefs.production).toEqual([
      "DOSESPOT_PROD_CLINIC_ID_REF", "DOSESPOT_PROD_USER_ID_REF",
      "DOSESPOT_PROD_CLINIC_KEY_REF", "DOSESPOT_PROD_SUBSCRIPTION_KEY_REF",
    ]);
  });

  it("declares no OAuth client id/secret", () => {
    const all = [...VENDORS.dosespot.secretRefs.sandbox, ...VENDORS.dosespot.secretRefs.production];
    expect(all.some((r) => /CLIENT_ID|CLIENT_SECRET/.test(r))).toBe(false);
  });
});

describe("doseSpotAdapter has no direct transmission path", () => {
  const gatedRow = (capability: string): OnboardingRow => ({
    id: "v1", hospital_id: "h1", vendor_key: "dosespot", environment: "sandbox",
    state: "sandbox_configured",
    capabilities: {
      [capability]: true,
      dosespot_rest: { restGuide: { evidenceRef: "ref", approved: true } },
      // Fabricated private endpoint map — must not create a transport path.
      endpoints: { new_rx: "https://attacker.example/newrx", epcs: "https://attacker.example/epcs" },
    },
    secret_ref_names: [...VENDORS.dosespot.secretRefs.sandbox],
    last_test_result: null, evidence_expires_at: null,
  });

  for (const capability of ["new_rx", "epcs"]) {
    it(`returns the stable unavailable reason for ${capability} despite a fabricated endpoint`, async () => {
      const spy = vi.spyOn(globalThis, "fetch");
      const res = await doseSpotAdapter.execute(gatedRow(capability), {
        capability, endpointKey: capability, correlationId: "c1", idempotencyKey: "i1",
      });
      expect(res).toEqual({ status: "unavailable", reason: DOSESPOT_NEW_RX_BLOCKER });
      expect(DOSESPOT_NEW_RX_BLOCKER).toBe("rest_new_rx_not_documented_use_jumpstart");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  }

  it("never reaches transport for any DoseSpot capability", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const capability of VENDORS.dosespot.capabilities) {
      const res = await doseSpotAdapter.execute(gatedRow(capability), {
        capability, endpointKey: capability, correlationId: "c1", idempotencyKey: "i1",
      });
      expect(["blocked", "unavailable"]).toContain(res.status);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("buildRestUrl scheme enforcement", () => {
  it("rejects a directly constructed non-HTTPS config", () => {
    for (const baseUrl of ["http://sandbox.example-dosespot.test/", "ftp://sandbox.example-dosespot.test/"]) {
      expect(() => buildRestUrl({ ...config, baseUrl }, "general_check")).toThrow(/base_url_invalid/);
    }
  });
});
