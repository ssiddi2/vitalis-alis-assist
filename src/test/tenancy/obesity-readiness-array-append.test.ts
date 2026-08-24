import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: the deployed readiness function raised 22P02 (`malformed array
 * literal`) because `text[] || <scalar text>` is ambiguous. Every scalar append
 * in the newest definition must use explicit array_append.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
const NAME = "obesity_launch_readiness_internal";

/** Newest migration that redefines the readiness function, and that definition. */
const latest = (() => {
  const file = [...FILES].reverse()
    .find((f) => readFileSync(path.join(MIGRATIONS, f), "utf8")
      .includes(`CREATE OR REPLACE FUNCTION public.${NAME}(`))!;
  const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
  return { file, body: sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${NAME}(`)) };
})();

describe("newest obesity readiness migration appends safely", () => {
  it("contains no ambiguous scalar append to a text array", () => {
    expect(latest.body).not.toMatch(/blockers\s*:=\s*blockers\s*\|\|/);
    expect(latest.body).not.toMatch(/missing\s*:=\s*missing\s*\|\|/);
  });

  it("appends every fixed and dynamic key through array_append", () => {
    for (const expr of [
      "'service_state_available'", "'authorized_provider'", "'governance_' || k",
      "'note_template'", "'consents'", "'cash_pay_fee_configured'",
      "'identifier_mappings'", "'prescriber_registration'", "'epcs_when_in_scope'",
      "'no_critical_defects'", "k",
    ]) {
      expect(latest.body).toContain(`array_append(blockers, ${expr})`);
    }
    expect(latest.body).toContain("array_append(missing, p)");
  });

  it("appends the loop variable for both the internal gate loop and the DoseSpot loop", () => {
    const hits = latest.body.match(/array_append\(blockers, k\);/g) ?? [];
    expect(hits.length).toBe(2);
  });

  it("keeps jsonb gate accumulation on the jsonb || operator", () => {
    expect(latest.body).toMatch(/gates := gates \|\| jsonb_build_object/);
    expect(latest.body).not.toMatch(/array_append\(gates/);
  });

  it("preserves the definer, search_path and grant posture", () => {
    expect(latest.body).toMatch(/STABLE SECURITY DEFINER SET search_path = ''/);
    expect(latest.body).toMatch(
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${NAME}\\([^)]*\\) FROM public, anon, authenticated;`),
    );
    expect(latest.body).toMatch(
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${NAME}\\([^)]*\\) TO service_role;`),
    );
    expect(latest.body).not.toMatch(new RegExp(`${NAME}\\([^)]*\\) TO authenticated`));
  });

  it("is a new forward migration, not an edit of the already-applied one", () => {
    expect(latest.file > "20260824173809").toBe(true);
  });
});
