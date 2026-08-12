import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEffectivePolicies } from "./policyParser";

/**
 * SECURITY DEFINER least-privilege gate.
 * Internal definer functions must be unreachable by anon/authenticated (triggers
 * run them as the table owner and are unaffected). The only two definer helpers
 * exposed to signed-in users are the role checks that RLS itself depends on —
 * and they must be self-scoped, so a signed-in user cannot probe another user's
 * platform role or another facility's governance role.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");

const EXPOSED = ["has_role", "has_governance_role"];
const INTERNAL = [
  "apply_access_attestation", "audit_note_draft_delete", "audit_phi_changes", "deny_mutation",
  "enforce_note_integrity", "handle_new_user", "log_audit_event", "log_vendor_onboarding_event",
  "prevent_vitals_reassignment", "reset_demo_data", "stamp_team_channel_actor", "update_updated_at",
];

/** Last definition of a function across all migrations — the effective one. */
const definitionOf = (name: string) => {
  const re = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\s*\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$`, "gi");
  const all = sql.match(re) ?? [];
  return all[all.length - 1] ?? "";
};

describe("security definer least privilege", () => {
  it("revokes internal definer functions from PUBLIC, anon and authenticated", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION %s TO service_role/);
    // the revoke loop must cover every definer function except the RLS helpers
    const loop = sql.slice(sql.indexOf("prosecdef"));
    for (const name of EXPOSED) expect(loop).toContain(`'${name}'`);
  });

  it("never grants an internal definer function to anon or authenticated", () => {
    const grants = sql.split(";").filter((s2) => /GRANT[\s\S]*EXECUTE[\s\S]*FUNCTION/i.test(s2));
    for (const name of INTERNAL) {
      const bad = grants.filter((g) => new RegExp(`public\\.${name}\\s*\\(`, "i").test(g) && /\b(anon|authenticated)\b/.test(g));
      expect(bad, name).toEqual([]);
    }
  });

  it("keeps the two RLS helpers executable by authenticated but never by anon", () => {
    for (const name of EXPOSED) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon`));
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO authenticated, service_role`));
    }
  });

  it("self-scopes the exposed role helpers so cross-user probing returns false", () => {
    for (const name of EXPOSED) {
      const def = definitionOf(name);
      expect(def, name).toContain("_user_id = auth.uid()");
      expect(def, name).toContain("SECURITY DEFINER");
      expect(def, name).toContain("SET search_path = public");
      expect(def, name).toContain("_user_id IS NOT NULL"); // null-input rejection
    }
    expect(definitionOf("has_governance_role")).toContain("_hospital_id IS NOT NULL");
    // governance stays facility-scoped and ignores revoked grants
    expect(definitionOf("has_governance_role")).toContain("g.hospital_id = _hospital_id");
    expect(definitionOf("has_governance_role")).toContain("g.revoked_at IS NULL");
  });

  it("every RLS policy calls the role helpers with auth.uid(), never a client-supplied id", () => {
    const calls = [...sql.matchAll(/has_(?:governance_)?role\s*\(\s*([^,]+),/g)]
      .map((m) => m[1].trim())
      .filter((a) => !a.startsWith("_")); // skip the function declarations themselves
    expect(calls.length).toBeGreaterThan(0);
    for (const first of calls) expect(first).toBe("auth.uid()");
  });

  it("trigger enforcement still runs the definer functions after the revokes", () => {
    for (const name of ["enforce_note_integrity", "prevent_vitals_reassignment", "deny_mutation", "update_updated_at"]) {
      expect(sql, name).toMatch(new RegExp(`EXECUTE FUNCTION public\\.${name}\\(`, "i"));
    }
    // trigger functions are never dropped or switched to invoker
    for (const name of INTERNAL) {
      expect(sql, name).not.toMatch(new RegExp(`ALTER FUNCTION public\\.${name}[^;]*SECURITY INVOKER`, "i"));
    }
  });

  it("does not weaken tenant scoping of the policies that depend on the helpers", () => {
    const policies = loadEffectivePolicies();
    const usingHelper = [...policies.values()].flat()
      .filter((p) => /has_(governance_)?role/.test(p.expr));
    expect(usingHelper.length).toBeGreaterThan(0);
    for (const p of usingHelper) expect(p.expr).toContain("auth.uid()");
  });
});
