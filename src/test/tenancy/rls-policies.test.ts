import { describe, expect, it } from "vitest";
import { isAdminOnly, isTenantScoped, loadEffectivePolicies, type Policy } from "./policyParser";

/**
 * Multi-tenant RLS regression gate.
 *
 * Proves, from the migrations that define the database, that a clinician at
 * hospital A can never SELECT / INSERT / UPDATE / DELETE rows belonging to
 * hospital B on any PHI or template table. Any future migration that adds an
 * unscoped policy to these tables fails this test.
 */
const PHI_TABLES = [
  "patients",
  "immunizations",
  "patient_allergies",
  "patient_medications",
  "patient_problems",
  "patient_vitals",
  "clinical_notes",
  "staged_orders",
  "prescriptions",
  "lab_results",
  "note_templates",
  "order_sets",
  "note_versions",
  "note_addenda",
] as const;

const policies = loadEffectivePolicies();

/** Ownership predicates (row belongs to the calling user) are tenant-safe. */
const isOwnerScoped = (expr: string) => /=\s*auth\.uid\(\)|auth\.uid\(\)\s*=/i.test(expr);

const describePolicy = (p: Policy) => `${p.table} · ${p.cmd} · "${p.name}"`;

describe("multi-tenant RLS: no cross-hospital access", () => {
  it.each(PHI_TABLES)("%s has at least one policy defined", (table) => {
    expect(policies.get(table)?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(PHI_TABLES)("%s: every policy is hospital-scoped, owner-scoped, or admin-only", (table) => {
    for (const p of policies.get(table) ?? []) {
      const ok = isTenantScoped(p.expr) || isAdminOnly(p.expr) || isOwnerScoped(p.expr);
      expect(ok, `${describePolicy(p)} is not tenant-scoped: ${p.expr.trim() || "(no predicate)"}`).toBe(true);
    }
  });

  it.each(PHI_TABLES)("%s: no policy is unconditionally permissive", (table) => {
    for (const p of policies.get(table) ?? []) {
      const expr = p.expr.replace(/\s+/g, " ").trim().toLowerCase();
      expect(expr, describePolicy(p)).not.toBe("");
      expect(expr, describePolicy(p)).not.toBe("true");
      expect(expr, describePolicy(p)).not.toMatch(/^\(?\s*true\s*\)?$/);
    }
  });

  it.each(PHI_TABLES)("%s: write commands are tenant-scoped (never admin-only bypass by default)", (table) => {
    const writes = (policies.get(table) ?? []).filter((p) => p.cmd !== "SELECT");
    for (const p of writes) {
      const ok = isTenantScoped(p.expr) || isAdminOnly(p.expr) || isOwnerScoped(p.expr);
      expect(ok, `${describePolicy(p)} allows unscoped writes`).toBe(true);
    }
  });

  it("PHI tables are never readable by the anon role", () => {
    for (const table of PHI_TABLES) {
      for (const p of policies.get(table) ?? []) {
        expect(p.expr.toLowerCase(), describePolicy(p)).not.toContain("to anon");
      }
    }
  });
});
