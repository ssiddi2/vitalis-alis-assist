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
  "consultation_notes",
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

describe("scoped write paths added by the RLS hardening pass", () => {
  const of = (table: string, cmd: string) =>
    (policies.get(table) ?? []).filter((p) => p.cmd === cmd);

  it("consultation_notes INSERT requires clinician/admin membership, thread+patient match and created_by", () => {
    const ins = of("consultation_notes", "INSERT");
    expect(ins).toHaveLength(1);
    const expr = ins[0].expr.toLowerCase();
    expect(expr).toContain("has_role(auth.uid(), 'clinician')");
    expect(expr).toContain("created_by = auth.uid()");
    expect(expr).toContain("hospital_users");
    expect(expr).toContain("ct.patient_id = consultation_notes.patient_id");
    expect(expr).toContain("p.hospital_id = ct.hospital_id");
  });

  it("consultation_notes UPDATE cannot re-point a note at another thread or patient", () => {
    const upd = of("consultation_notes", "UPDATE");
    const expr = upd[upd.length - 1].expr.toLowerCase();
    // parser concatenates USING + WITH CHECK: the post-update check binds thread↔patient
    expect(expr).toContain("ct.patient_id = consultation_notes.patient_id");
    expect(expr).toContain("hospital_users");
    // only the treating clinician (or an admin) may write, never a viewer
    expect(expr).toContain("has_role(auth.uid(), 'clinician')");
    expect(expr.match(/ct\.primary_clinician_id = auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("patient_vitals writes are hospital- and patient-scoped, with no clinician delete", () => {
    const writes = (policies.get("patient_vitals") ?? []).filter((p) => p.cmd !== "SELECT");
    expect(writes.length).toBeGreaterThan(0);
    for (const p of writes) {
      const expr = p.expr.toLowerCase();
      expect(expr, p.name).toContain("hospital_users");
      expect(isTenantScoped(p.expr) || isAdminOnly(p.expr), p.name).toBe(true);
    }
    // clinicians get INSERT + UPDATE only; deletion stays admin-only, same hospital
    const clinicianVitals = writes.filter((p) => /own hospital vitals/i.test(p.name));
    expect(clinicianVitals.map((p) => p.cmd).sort()).toEqual(["INSERT", "UPDATE"]);
    for (const p of clinicianVitals) expect(p.expr.toLowerCase()).toContain("patient_vitals.patient_id");
    const admin = writes.filter((p) => p.cmd === "ALL");
    expect(admin).toHaveLength(1);
    expect(admin[0].expr.toLowerCase()).toContain("has_role(auth.uid(), 'admin')");
    // scoped in both USING and WITH CHECK (two occurrences of the predicate)
    expect(admin[0].expr.toLowerCase().match(/patient_vitals\.patient_id/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("tenant-scoped INSERT/UPDATE on scheduling & collaboration tables", () => {
  const of = (table: string, cmd: string) =>
    (policies.get(table) ?? []).filter((p) => p.cmd === cmd);
  const latest = (table: string, cmd: string) => {
    const list = of(table, cmd);
    expect(list.length, `${table} ${cmd} policy missing`).toBeGreaterThan(0);
    return list[list.length - 1].expr.toLowerCase();
  };

  // every write must prove hospital membership AND that the patient lives in that hospital
  const TENANT_WRITES: Array<[string, string, string]> = [
    ["appointments", "INSERT", "appointments"],
    ["appointments", "UPDATE", "appointments"],
    ["consult_requests", "INSERT", "consult_requests"],
    ["consult_requests", "UPDATE", "consult_requests"],
    ["encounters", "INSERT", "encounters"],
    ["consultation_threads", "INSERT", "consultation_threads"],
    ["consultation_threads", "UPDATE", "consultation_threads"],
    ["team_channels", "INSERT", "team_channels"],
    ["team_channels", "UPDATE", "team_channels"],
  ];

  it.each(TENANT_WRITES)("%s %s is bound to the caller's hospital", (table, cmd, ref) => {
    const expr = latest(table, cmd);
    expect(expr).toContain("hospital_users");
    expect(expr).toContain(`hu.hospital_id = ${ref}.hospital_id`);
    expect(expr).toContain(`p.hospital_id = ${ref}.hospital_id`);
  });

  it.each([
    ["consult_requests", "requesting_user_id"],
    ["encounters", "provider_id"],
    ["consultation_threads", "primary_clinician_id"],
    ["team_channels", "created_by"],
  ])("%s INSERT stamps the authenticated actor via %s", (table, actor) => {
    const expr = latest(table, "INSERT");
    expect(expr).toContain(`${table}.${actor} = auth.uid()`);
    expect(expr).toContain("has_role(auth.uid(), 'clinician')");
  });

  it("appointments INSERT keeps the provider and any encounter inside the same hospital", () => {
    const expr = latest("appointments", "INSERT");
    expect(expr).toContain("hp.user_id = appointments.provider_id");
    expect(expr).toContain("e.hospital_id = appointments.hospital_id");
  });

  it("consultation_threads and consult_requests keep specialists inside the hospital", () => {
    for (const table of ["consultation_threads", "consult_requests"]) {
      const expr = latest(table, "INSERT");
      expect(expr, table).toContain(`c.hospital_id = ${table}.hospital_id`);
    }
  });

  it.each(TENANT_WRITES)("%s %s is never unconditionally permissive", (table, cmd) => {
    const expr = latest(table, cmd).replace(/\s+/g, " ").trim();
    expect(expr, `${table} ${cmd}`).not.toMatch(/^\(?\s*true\s*\)?$/);
    expect(expr).not.toBe("");
  });
});

