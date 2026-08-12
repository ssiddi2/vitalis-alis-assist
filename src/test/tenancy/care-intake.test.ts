import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";
import { CARE_REQUEST_FLOW, SAFETY_SCREEN_QUESTIONS } from "@/lib/careRequests";

/**
 * National intake & routing regression gate.
 *
 * Proves from the migrations that eligibility, state coverage, provider
 * authorization, red-flag hard stops, transition legality, concurrency and the
 * append-only event trail are enforced in the database — never in the UI.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const TABLES = [
  "service_lines",
  "state_service_availability",
  "provider_service_lines",
  "safety_screen_templates",
  "care_requests",
  "care_request_events",
] as const;

describe("care intake tenancy", () => {
  it.each(TABLES)("%s: every policy is tenant-scoped or admin-only", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      const ok = isTenantScoped(p.expr) || /has_role\(\s*auth\.uid\(\)/i.test(p.expr);
      expect(ok, `${table} · ${p.name} is not tenant-scoped`).toBe(true);
    }
  });

  it.each(TABLES)("%s: no anonymous or public access", (table) => {
    for (const p of policies.get(table) ?? []) {
      expect(p.roles ?? ["authenticated"]).not.toContain("anon");
      expect(p.roles ?? ["authenticated"]).not.toContain("public");
    }
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON\\s+public\\.${table}\\s+TO\\s+anon`, "i"));
  });

  it("catalog configuration is admin-only", () => {
    for (const table of ["service_lines", "state_service_availability", "provider_service_lines", "safety_screen_templates"]) {
      for (const p of policies.get(table) ?? []) {
        if (p.cmd !== "SELECT") {
          expect(/has_role\(\s*auth\.uid\(\),\s*'admin'/i.test(p.expr), `${table} · ${p.name}`).toBe(true);
        }
      }
    }
  });

  it("care_request_events is append-only for clients", () => {
    const list = policies.get("care_request_events") ?? [];
    expect(list.filter((p) => p.cmd === "UPDATE" || p.cmd === "DELETE" || p.cmd === "ALL")).toHaveLength(0);
    expect(sql).toMatch(/CREATE TRIGGER care_request_events_append_only[\s\S]*deny_mutation/i);
  });

  it("care_requests cannot be deleted by clients", () => {
    expect((policies.get("care_requests") ?? []).some((p) => p.cmd === "DELETE" || p.cmd === "ALL")).toBe(false);
    expect(sql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON\s+public\.care_requests\s+TO\s+authenticated/i);
  });

  it("requesters may only create their own requests, patient bound to the facility", () => {
    const insert = (policies.get("care_requests") ?? []).find((p) => p.cmd === "INSERT");
    expect(insert).toBeDefined();
    expect(insert!.expr).toMatch(/created_by\s*=\s*auth\.uid\(\)/i);
    expect(insert!.expr).toMatch(/hospital_users/i);
    expect(insert!.expr).toMatch(/patients/i);
  });
});

describe("care request lifecycle enforcement", () => {
  it("lifecycle trigger exists on insert and update", () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.enforce_care_request_lifecycle/i);
    expect(sql).toMatch(/CREATE TRIGGER enforce_care_request_lifecycle BEFORE INSERT OR UPDATE ON public\.care_requests/i);
  });

  it("rejects illegal transitions and edits to closed requests", () => {
    expect(sql).toMatch(/illegal care request transition/i);
    expect(sql).toMatch(/closed care requests are immutable/i);
  });

  it("client-side flow map matches the enforced terminal states", () => {
    expect(CARE_REQUEST_FLOW.scheduled).toHaveLength(0);
    expect(CARE_REQUEST_FLOW.declined).toHaveLength(0);
    expect(CARE_REQUEST_FLOW.cancelled).toHaveLength(0);
    expect(CARE_REQUEST_FLOW.draft).toContain("submitted");
    // waitlisted is only ever reached server-side
    expect(Object.values(CARE_REQUEST_FLOW).flat()).not.toContain("waitlisted");
  });

  it("actor, patient, facility and triage attribution are immutable", () => {
    expect(sql).toMatch(/care request patient, facility and requester are immutable/i);
    expect(sql).toMatch(/submitted care request intake is immutable/i);
    expect(sql).toMatch(/triage attribution is immutable/i);
  });

  it("only the requester may submit and only clinical staff may triage", () => {
    expect(sql).toMatch(/only the requester may submit this care request/i);
    expect(sql).toMatch(/only clinical staff may triage or schedule a care request/i);
  });

  it("submission requires state, verified callback, consent, reason and screen", () => {
    expect(sql).toMatch(/the patient physical state is required before submitting/i);
    expect(sql).toMatch(/a verified callback number is required before submitting/i);
    expect(sql).toMatch(/consent must be acknowledged before submitting/i);
    expect(sql).toMatch(/a reason for the visit is required before submitting/i);
    expect(sql).toMatch(/the safety screen must be completed before submitting/i);
  });

  it("configured eligibility is enforced server-side", () => {
    expect(sql).toMatch(/this service is not currently offered/i);
    expect(sql).toMatch(/this service is not accepting new patients/i);
    expect(sql).toMatch(/this service is not accepting established patients/i);
    expect(sql).toMatch(/a referral is required for this service/i);
    expect(sql).toMatch(/prior records are required for this service/i);
    expect(sql).toMatch(/minimum age for this service/i);
  });

  it("state coverage defaults to unavailable and never silently schedules", () => {
    expect(sql).toMatch(/status\s+text\s+NOT NULL\s+DEFAULT\s+'unavailable'/i);
    expect(sql).toMatch(/this service is not available in the patient state yet/i);
    expect(sql).toMatch(/waitlisted/);
  });

  it("scheduling verifies membership, service assignment, licence and FK containment", () => {
    expect(sql).toMatch(/the assigned provider is not a member of this facility/i);
    expect(sql).toMatch(/the assigned provider is not active for this service line/i);
    expect(sql).toMatch(/the assigned provider is not authorized in the patient state/i);
    expect(sql).toMatch(/the appointment must match this facility, patient and assigned provider/i);
    expect(sql).toMatch(/an assigned provider and appointment are required to schedule/i);
  });

  it("provider authorization must be current and telehealth-permitted", () => {
    const fn = sql.slice(sql.indexOf("enforce_care_request_lifecycle"));
    expect(fn).toMatch(/telehealth_permitted/i);
    expect(fn).toMatch(/expiration_date IS NULL OR .*expiration_date >= current_date/i);
  });

  it("stamps lock_version for optimistic concurrency", () => {
    expect(sql).toMatch(/lock_version\s*:=\s*OLD\.lock_version\s*\+\s*1/i);
  });
});

describe("safety screen", () => {
  it("red flags are a hard stop on submission and scheduling", () => {
    expect(sql).toMatch(/emergency symptoms reported: routine submission is blocked/i);
    expect(sql).toMatch(/a red-flagged request cannot be routinely scheduled/i);
  });

  it("templates require medical-director approval attributed to the approver", () => {
    expect(sql).toMatch(/safety screen templates require medical-director approval before activation/i);
    expect(sql).toMatch(/safety screen approval must be attributed to the approving user/i);
    expect(sql).toMatch(/approved safety screens are immutable/i);
  });

  it("the static screen covers the conservative emergency set", () => {
    const codes = SAFETY_SCREEN_QUESTIONS.map((q) => q.code);
    for (const c of ["breathing", "chest_pain", "stroke", "bleeding", "allergic", "self_harm", "pregnancy_emergency"]) {
      expect(codes).toContain(c);
    }
  });
});

describe("definer hygiene", () => {
  it("routing helper is least-privilege with a fixed search_path and no public grant", () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.care_routing_status\(uuid, uuid, text\) TO authenticated/i);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.care_routing_status[^;]*TO\s+(public|anon)/i);
    const fn = sql.slice(sql.indexOf("public.care_routing_status"));
    expect(fn.slice(0, 800)).toMatch(/SET search_path/i);
  });

  it("does not expose provider licence numbers through routing", () => {
    const fn = sql.slice(sql.indexOf("public.care_routing_status"), sql.indexOf("enforce_care_request_lifecycle"));
    expect(fn).not.toMatch(/license_number/i);
  });
});
