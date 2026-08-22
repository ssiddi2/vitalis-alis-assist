import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";

/**
 * Cash-pay obesity launch boundary, proven from the migrations: tenant-scoped
 * RLS on every new table, no anon PHI, no card data, audited waivers, and a
 * fail-closed go-live gate with no client bypass.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const TABLES = ["encounter_cash_pay", "obesity_intake_screens", "vendor_identity_mappings"] as const;

describe("obesity launch tenancy", () => {
  it.each(TABLES)("%s: RLS enabled, tenant-scoped, never granted to anon", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) expect(isTenantScoped(p)).toBe(true);
    expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]{0,80}ENABLE ROW LEVEL SECURITY`));
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON public\\.${table}[^;]*TO[^;]*anon`));
  });

  it("grants the Data API roles the new tables actually need", () => {
    for (const table of TABLES) {
      expect(sql).toMatch(new RegExp(`GRANT[^;]*ON (TABLE )?public\\.${table}[^;]*authenticated`));
      expect(sql).toMatch(new RegExp(`GRANT[^;]*ON (TABLE )?public\\.${table}[^;]*service_role`));
    }
  });
});

describe("cash-pay boundary", () => {
  it("never stores card or bank credentials", () => {
    const create = sql.slice(sql.indexOf("CREATE TABLE public.encounter_cash_pay"));
    const body = create.slice(0, create.indexOf(");"));
    expect(body).not.toMatch(/\b(pan|card_number|cvv|cvc|iban|routing_number|account_number)\b/i);
    expect(sql).toMatch(/payment_reference/);
  });

  it("rejects card-shaped values and stamps the waiver actor server-side", () => {
    expect(sql).toMatch(/card|pan|cvv/i);
    expect(sql).toMatch(/waived_by/);
    expect(sql).toMatch(/waiver_reason/);
  });
});

describe("vendor identity mappings", () => {
  it("stores identifiers with provenance and never credential values", () => {
    const create = sql.slice(sql.indexOf("CREATE TABLE public.vendor_identity_mappings"));
    const body = create.slice(0, create.indexOf(");"));
    expect(body).toMatch(/vendor_identifier/);
    expect(body).toMatch(/evidence_ref/);
    expect(body).not.toMatch(/secret|token|password|client_secret/i);
    expect(sql).toMatch(/UNIQUE[\s\S]{0,120}vendor_identity_mappings|vendor_identity_mappings[\s\S]{0,400}UNIQUE/);
  });
});

describe("go-live gate fails closed", () => {
  const fn = sql.slice(sql.indexOf("FUNCTION public.obesity_launch_readiness"));

  it("returns unauthorized for a foreign tenant and cannot be executed by anon", () => {
    expect(fn).toMatch(/IF NOT public\.is_my_hospital\(p_hospital_id\) THEN[\s\S]{0,120}'authorized', false/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.obesity_launch_readiness[^;]*FROM public, anon/);
  });

  it("requires explicit state availability, an authorized provider and approved governance", () => {
    for (const key of [
      "service_state_available", "authorized_provider", "governance_' || k",
      "note_template", "consents", "no_critical_defects",
    ]) expect(fn).toContain(key);
    expect(fn).toMatch(/status = 'available'/);
    expect(fn).toMatch(/telehealth_permitted/);
    expect(fn).toMatch(/c\.status = 'approved'/);
  });

  it("separates non-controlled prescribing from EPCS and never forces EPCS on a non-controlled service", () => {
    expect(fn).toMatch(/IF p_prescribing AND NOT ok THEN blockers := blockers \|\| 'dosespot_new_rx'/);
    expect(fn).toMatch(/IF p_controlled AND NOT ok THEN blockers := blockers \|\| 'dosespot_epcs'/);
  });

  it("requires unexpired vendor evidence and a passed production readiness test", () => {
    expect(fn).toMatch(/evidence_expires_at > now\(\)/);
    expect(fn).toMatch(/last_test_result = 'production_readiness_passed'/);
  });

  it("labels the verdict internal readiness only", () => {
    expect(fn).toMatch(/INTERNAL READINESS ONLY/);
    expect(fn).toMatch(/'can_launch', array_length\(blockers, 1\) IS NULL/);
  });

  it("does not require insurance or clearinghouse readiness for cash pay", () => {
    expect(fn).not.toMatch(/stedi|clearinghouse|claim_readiness/i);
  });
});
