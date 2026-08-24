import { describe, it, expect } from "vitest";
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
