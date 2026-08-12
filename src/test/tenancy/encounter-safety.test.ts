import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";

/**
 * Encounter safety regression gate.
 *
 * Proves from the migrations that the encounter lifecycle, telehealth
 * prerequisites, completion prerequisites, immutability and the append-only
 * event trail are enforced in the database — not in the UI.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const TABLES = ["encounters", "encounter_events", "encounter_diagnoses", "provider_licenses"] as const;

describe("encounter safety", () => {
  it.each(TABLES)("%s: every policy is hospital-scoped or admin-only", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      const ok = isTenantScoped(p.expr) || /has_role\(\s*auth\.uid\(\)/i.test(p.expr);
      expect(ok, `${table} · ${p.name} is not tenant-scoped`).toBe(true);
    }
  });

  it("encounter_events is append-only for clients", () => {
    const list = policies.get("encounter_events") ?? [];
    expect(list.filter((p) => p.cmd === "UPDATE" || p.cmd === "DELETE" || p.cmd === "ALL")).toHaveLength(0);
    expect(list.some((p) => p.cmd === "SELECT")).toBe(true);
  });

  it("provider_licenses writes are admin-only; clinicians read only", () => {
    for (const p of policies.get("provider_licenses") ?? []) {
      if (p.cmd !== "SELECT") expect(/has_role\(\s*auth\.uid\(\),\s*'admin'/i.test(p.expr)).toBe(true);
    }
  });

  it("lifecycle trigger exists and rejects illegal transitions", () => {
    expect(sql).toMatch(/create\s+(or\s+replace\s+)?function\s+public\.enforce_encounter_lifecycle/i);
    expect(sql).toMatch(/create\s+trigger[\s\S]*enforce_encounter_lifecycle/i);
    expect(sql).toMatch(/illegal encounter transition/i);
  });

  it("telehealth start requires identity, location, consent, callback and an active state authorization", () => {
    const body = sql.slice(sql.search(/enforce_encounter_lifecycle/i));
    for (const token of [
      "identity_verified_at",
      "patient_state_code",
      "telehealth_consent_accepted_at",
      "callback_phone_verified",
      "provider_licenses",
    ]) {
      expect(body, `start prerequisite missing: ${token}`).toContain(token);
    }
    expect(body).toMatch(/expiration_date/i);
  });

  it("completion requires signed note, diagnosis, disposition, follow-up and reconciliation", () => {
    const body = sql.slice(sql.search(/enforce_encounter_lifecycle/i));
    for (const token of [
      "note_versions",
      "encounter_diagnoses",
      "disposition",
      "follow_up_instructions",
      "med_rec_completed_at",
      "allergy_review_at",
    ]) {
      expect(body, `completion prerequisite missing: ${token}`).toContain(token);
    }
    expect(body).toMatch(/completed_at/i);
    expect(body).toMatch(/completed_by/i);
  });

  it("completed encounters are immutable except through the admin reopen path", () => {
    expect(sql).toMatch(/completed encounters are immutable|cannot be modified after completion/i);
    expect(sql).toMatch(/create\s+(or\s+replace\s+)?function\s+public\.reopen_encounter/i);
    expect(sql).toMatch(/reopen[\s\S]{0,400}reason/i);
  });

  it("readiness helper is exposed to authenticated clients only", () => {
    expect(sql).toMatch(/create\s+(or\s+replace\s+)?function\s+public\.encounter_readiness/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.encounter_readiness[^;]*authenticated/i);
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.encounter_readiness[^;]*\banon\b/i);
  });

  it("optimistic concurrency is available and used by the client write path", () => {
    expect(sql).toMatch(/lock_version/i);
    const client = readFileSync(path.resolve(process.cwd(), "src/lib/encounterLifecycle.ts"), "utf8");
    expect(client).toMatch(/\.eq\('lock_version', lockVersion\)/);
    expect(client).toMatch(/StaleEncounterError/);
  });

  it("client transitions never bypass the enforced path", () => {
    const clinic = readFileSync(path.resolve(process.cwd(), "src/pages/Clinic.tsx"), "utf8");
    expect(clinic).not.toMatch(/status:\s*'in_progress'/);
    expect(clinic).toContain("transitionEncounter");
  });
});
