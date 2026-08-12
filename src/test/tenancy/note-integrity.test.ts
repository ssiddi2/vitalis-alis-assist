import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";

/**
 * Signed-note integrity regression gate.
 *
 * Proves from the migrations + edge function source that signed clinical notes
 * are immutable, corrections are append-only addenda, snapshots capture a hash
 * and version, and cosigning is permission-checked server-side.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const fn = readFileSync(
  path.resolve(process.cwd(), "supabase/functions/note-integrity/index.ts"),
  "utf8",
);

const policies = loadEffectivePolicies();
const NOTE_TABLES = ["clinical_notes", "note_versions", "note_addenda"] as const;

describe("signed note integrity", () => {
  it.each(NOTE_TABLES)("%s: every policy is hospital-scoped or admin-only", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      const ok = isTenantScoped(p.expr) || /has_role\(\s*auth\.uid\(\)/i.test(p.expr);
      expect(ok, `${table} · ${p.name} is not tenant-scoped`).toBe(true);
    }
  });

  it.each(["note_versions", "note_addenda"] as const)("%s: no client role can delete", (table) => {
    expect((policies.get(table) ?? []).filter((p) => p.cmd === "DELETE" || p.cmd === "ALL")).toHaveLength(0);
  });

  it("clinical notes: the only delete path is an author's own unsigned draft", () => {
    const del = (policies.get("clinical_notes") ?? []).filter((p) => p.cmd === "DELETE" || p.cmd === "ALL");
    expect(del).toHaveLength(1);
    const expr = del[0].expr.toLowerCase();
    expect(expr).toContain("status = 'draft'");
    expect(expr).toContain("signed_at is null");
    expect(expr).toContain("signed_by is null");
    expect(expr).toContain("content_hash is null");
    expect(expr).toContain("cosigned_at is null");
    expect(expr).toContain("author_id = auth.uid()");
    expect(expr).toContain("hospital_users");
  });

  it("the integrity trigger only permits deletion of a pure draft, for every role", () => {
    expect(sql).toMatch(/IF OLD\.status <> 'draft' OR OLD\.signed_at IS NOT NULL OR OLD\.content_hash IS NOT NULL THEN/);
  });

  it("draft deletion is audited without clinical content", () => {
    expect(sql).toContain("audit_note_draft_delete");
    expect(sql).toContain("'note.draft_deleted'");
    const fnBlock = sql.slice(sql.indexOf("audit_note_draft_delete"), sql.indexOf("Generic PHI audit"));
    expect(fnBlock).not.toMatch(/to_jsonb\(OLD\)|OLD\.content/);
    // the generic row-dumping audit trigger no longer fires on note deletes
    expect(sql).toMatch(/CREATE TRIGGER audit_clinical_notes_changes\s+AFTER INSERT OR UPDATE ON public\.clinical_notes/);
  });

  it("clinical notes are only updatable by their author while still a draft", () => {
    const update = (policies.get("clinical_notes") ?? []).filter((p) => p.cmd === "UPDATE");
    expect(update.length).toBeGreaterThan(0);
    // The effective policy is the last one defined across migrations.
    const expr = update[update.length - 1].expr.toLowerCase();
    expect(expr).toContain("'draft'");
    expect(expr).toContain("pending_signature");
    expect(expr).toContain("author_id = auth.uid()");
    // both USING and WITH CHECK constrain the draft state (two occurrences)
    expect(expr.match(/'draft'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("versions and addenda are append-only for every role (no UPDATE/DELETE policy, deny trigger)", () => {
    for (const table of ["note_versions", "note_addenda"] as const) {
      expect((policies.get(table) ?? []).filter((p) => p.cmd !== "SELECT")).toHaveLength(0);
      expect(sql).toContain(`${table}_append_only`);
    }
    expect(sql).toContain("append-only");
  });

  it("a database trigger rejects any change to signed note content", () => {
    expect(sql).toContain("enforce_note_integrity");
    expect(sql).toContain("signed clinical notes are immutable");
    expect(sql).toContain("signed clinical notes cannot be deleted");
    expect(sql).toContain("signing requires signed_by, signed_at and content_hash");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.clinical_notes/i);
  });

  it("schema captures signature, hash, version, cosign and optimistic-concurrency fields", () => {
    for (const col of ["signed_by", "content_hash", "cosign_required", "cosigned_by", "cosigned_at", "lock_version"]) {
      expect(sql, col).toContain(col);
    }
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.note_versions/i);
    expect(sql).toMatch(/version integer NOT NULL/i);
    expect(sql).toMatch(/content_hash text NOT NULL/i);
    expect(sql).toMatch(/NEW\.lock_version := OLD\.lock_version \+ 1/);
  });

  it("addenda require a non-empty reason, an author and their own hash", () => {
    expect(sql).toMatch(/reason text NOT NULL CHECK \(length\(btrim\(reason\)\) > 0\)/i);
    expect(sql).toMatch(/author_id uuid NOT NULL/i);
    expect(fn).toContain("Addenda can only be added to a signed note");
  });
});

describe("note-integrity edge function", () => {
  it("enforces auth, rate limiting and hospital tenancy before any write", () => {
    expect(fn).toContain("guard(req");
    expect(fn).toContain("userHasHospitalAccess");
    expect(fn).toContain('ownedByHospital(admin, "clinical_notes"');
  });

  it("hashes content server-side and refuses to re-sign a signed note", () => {
    expect(fn).toContain('crypto.subtle.digest("SHA-256"');
    expect(fn).toContain("Note is already signed");
  });

  it("applies optimistic concurrency on sign", () => {
    expect(fn).toContain("lock_version !== note.lock_version");
    expect(fn).toContain('.eq("lock_version", note.lock_version)');
  });

  it("cosign requires a different clinician holding a clinician/admin role", () => {
    expect(fn).toContain("A note cannot be cosigned by its own author");
    expect(fn).toContain('r.role === "clinician" || r.role === "admin"');
    expect(fn).toContain("Note is already cosigned");
  });

  it("audit events carry identifiers and hashes only — never note content", () => {
    const auditBlock = fn.slice(fn.indexOf("const audit ="), fn.indexOf("/** Only the sections"));
    expect(auditBlock).not.toMatch(/\bcontent\b(?!_hash)/);
    expect(fn).toContain('event: "note.signed"');
    expect(fn).toContain('event: "note.addendum"');
    expect(fn).toContain('event: "note.cosigned"');
  });
});
