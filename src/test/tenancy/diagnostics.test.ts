import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";
import { DIAG_GATE_COPY } from "@/lib/diagnostics";

/**
 * Lab / imaging / external-record exchange regression gate.
 *
 * Proves from the migrations and shared adapter logic that tenancy, patient
 * matching, unverified-vendor denial, replay suppression, result immutability,
 * critical escalation and staging-only imports are enforced server-side.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const adapter = readFileSync(
  path.resolve(process.cwd(), "supabase/functions/diagnostics-adapter/index.ts"), "utf8");
const shared = readFileSync(
  path.resolve(process.cwd(), "supabase/functions/_shared/diagnostics.ts"), "utf8");

const policies = loadEffectivePolicies();
const TABLES = [
  "diagnostic_vendor_profiles",
  "smart_app_registrations",
  "terminology_mappings",
  "diagnostic_orders",
  "diagnostic_order_events",
  "diagnostic_results",
  "diagnostic_result_versions",
  "result_acknowledgements",
  "result_release_rules",
  "external_record_staging",
  "interop_outbox",
  "interop_inbox",
] as const;

describe("diagnostics tenancy", () => {
  it.each(TABLES)("%s: every policy is tenant-scoped or admin-only", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      const ok = isTenantScoped(p.expr) || /has_role\(\s*auth\.uid\(\)/i.test(p.expr);
      expect(ok, `${table} · ${p.name} is not tenant-scoped`).toBe(true);
    }
  });

  it.each(TABLES)("%s: no anonymous or public access", (table) => {
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON\\s+public\\.${table}\\s+TO\\s+(anon|public)`, "i"));
    expect(sql).not.toMatch(new RegExp(`ON\\s+public\\.${table}\\s+FOR\\s+\\w+\\s+TO\\s+anon`, "i"));
  });

  it("vendor profiles, SMART apps, mappings and release rules are admin-only to write", () => {
    for (const table of ["diagnostic_vendor_profiles", "smart_app_registrations", "terminology_mappings", "result_release_rules"]) {
      for (const p of policies.get(table) ?? []) {
        if (p.cmd !== "SELECT") {
          expect(/has_role\(\s*auth\.uid\(\),\s*'admin'/i.test(p.expr), `${table} · ${p.name}`).toBe(true);
        }
      }
    }
  });
});

describe("result and envelope integrity", () => {
  it("results are never inserted or deleted by clients", () => {
    expect(sql).toMatch(/GRANT SELECT, UPDATE ON public\.diagnostic_results TO authenticated/i);
    expect(sql).not.toMatch(/GRANT[^;]*INSERT[^;]*ON public\.diagnostic_results TO authenticated/i);
    expect(sql).toMatch(/CREATE TRIGGER diagnostic_results_no_client_delete[\s\S]{0,120}deny_mutation/i);
  });

  it("only the acknowledgement fields are client-writable on a result", () => {
    expect(sql).toMatch(/acknowledged fields[\s\S]{0,600}immutable|result content is immutable/i);
    expect(sql).toMatch(/CREATE TRIGGER enforce_diagnostic_result_integrity/i);
  });

  it("versions, acknowledgements, order events and interop envelopes are append-only", () => {
    for (const t of ["diagnostic_result_versions", "result_acknowledgements", "diagnostic_order_events", "interop_outbox", "interop_inbox"]) {
      expect(sql).toMatch(new RegExp(`CREATE TRIGGER ${t}_append_only[\\s\\S]{0,120}deny_mutation`, "i"));
      const list = policies.get(t) ?? [];
      expect(list.filter((p) => p.cmd === "UPDATE" || p.cmd === "DELETE" || p.cmd === "ALL")).toHaveLength(0);
    }
  });

  it("amendments bump the version instead of mutating the original", () => {
    expect(sql).toMatch(/version\s*=\s*[^;]*\+\s*1|NEW\.version\s*:=/i);
    expect(sql).toMatch(/'amended'|'corrected'/);
  });

  it("critical results require acknowledgement and are never auto-released to the patient", () => {
    expect(sql).toMatch(/is_critical/);
    expect(sql).toMatch(/patient_release_status/);
    expect(sql).toMatch(/is_critical[\s\S]{0,300}(withheld|blocked|hold)/i);
  });
});

describe("external record staging", () => {
  it("inbound data lands in staging and never silently mutates the chart", () => {
    expect(sql).toMatch(/CREATE TABLE public\.external_record_staging/i);
    expect(sql).toMatch(/CREATE TRIGGER enforce_record_staging_review/i);
    expect(sql).toMatch(/match_confidence/);
    expect(sql).toMatch(/consent_basis/);
    expect(adapter).toMatch(/external_record_staging/);
  });

  it("accepting a staged record requires a reviewer, a reason and a confirmed patient", () => {
    expect(sql).toMatch(/review_reason/);
    expect(sql).toMatch(/reviewed_by/);
    expect(adapter).toMatch(/accept_staged/);
    expect(adapter).toMatch(/patient_id/);
  });

  it("staged records cannot be deleted by clients", () => {
    expect(sql).toMatch(/CREATE TRIGGER external_record_staging_no_client_delete[\s\S]{0,120}deny_mutation/i);
  });

  it("patient matching is advisory and confidence-scored", () => {
    expect(shared).toMatch(/matchConfidence/);
  });
});

describe("vendor gating and replay protection", () => {
  it("production exchange fails closed until verified and end-to-end tested", () => {
    expect(shared).toMatch(/no_vendor_profile/);
    expect(shared).toMatch(/profile_unverified/);
    expect(shared).toMatch(/end_to_end_test_not_passed/);
    expect(shared).toMatch(/capability_not_enabled/);
    expect(shared).toMatch(/sandbox_test_mode/);
  });

  it("every gate reason has non-committal UI copy that never implies a live connection", () => {
    for (const key of ["no_vendor_profile", "profile_unverified", "capability_not_enabled",
      "end_to_end_test_not_passed", "sandbox_test_mode", "no_adapter"]) {
      expect(DIAG_GATE_COPY[key]).toBeTruthy();
      expect(DIAG_GATE_COPY[key].toLowerCase()).not.toMatch(/live|certified|production ready/);
    }
  });

  it("outbound and inbound envelopes are idempotent and replay-protected", () => {
    expect(sql).toMatch(/idempotency_key/);
    expect(sql).toMatch(/correlation_id/);
    expect(sql).toMatch(/message_control_id/);
    expect(sql).toMatch(/UNIQUE|unique/);
    expect(adapter).toMatch(/idempotent_replay|duplicate_message_control_id/);
  });

  it("only secret NAMES are stored — never credentials or raw payloads", () => {
    expect(sql).toMatch(/secret_ref_names/);
    expect(sql).toMatch(/secret_ref_names[\s\S]{0,400}\^\[A-Z\]/);
    expect(adapter).not.toMatch(/raw_payload|rawHl7|payload_blob/);
  });

  it("the adapter is JWT-verified, hospital-scoped and CORS-locked", () => {
    expect(adapter).toMatch(/_shared\/auth\.ts/);
    expect(adapter).toMatch(/_shared\/cors\.ts/);
    expect(adapter).toMatch(/userHasHospitalAccess/);
  });
});
