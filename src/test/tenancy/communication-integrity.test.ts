import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";

/**
 * Communication + consult accountability gate.
 *
 * Proves from the migrations that message records are immutable after insert,
 * actor attribution is stamped server-side, and consult requests can only be
 * advanced by an involved party.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const fn = (name: string) => {
  const i = sql.lastIndexOf(`FUNCTION public.${name}`);
  expect(i, `function ${name} not found`).toBeGreaterThan(-1);
  return sql.slice(i, sql.indexOf("$$;", i));
};
const trigger = (name: string, table: string) =>
  new RegExp(`CREATE\\s+TRIGGER\\s+${name}[\\s\\S]{0,200}ON\\s+public\\.${table}`, "i").test(sql);

const TABLES = ["consult_requests", "direct_messages", "team_messages", "acuity_scores", "acuity_feedback"] as const;

describe("communication integrity", () => {
  it.each(TABLES)("%s: every policy is tenant-scoped, participant-scoped or admin-only", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      const ok =
        isTenantScoped(p.expr) ||
        /has_role\(\s*auth\.uid\(\)/i.test(p.expr) ||
        /participant_1\s*=\s*auth\.uid\(\)/i.test(p.expr) ||
        /channel_members/i.test(p.expr);
      expect(ok, `${table} · ${p.name} is not scoped`).toBe(true);
    }
  });

  it.each(TABLES)("%s: no client DELETE or blanket ALL policy", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.filter((p) => p.cmd === "DELETE" || p.cmd === "ALL")).toHaveLength(0);
  });

  // ---- consult requests ----
  it("consult UPDATE requires actor participation or admin, not bare membership", () => {
    const upd = (policies.get("consult_requests") ?? []).filter((p) => p.cmd === "UPDATE");
    expect(upd).toHaveLength(1);
    const using = upd[0].expr;
    expect(using).toMatch(/requesting_user_id\s*=\s*auth\.uid\(\)/);
    expect(using).toMatch(/accepted_by\s*=\s*auth\.uid\(\)/);
    expect(using).toMatch(/has_role\(auth\.uid\(\),\s*'admin'\)/);
    expect(using).toMatch(/hospital_users/);
  });

  it("consult UPDATE WITH CHECK keeps patient, consultant and channel inside the hospital", () => {
    const upd = (policies.get("consult_requests") ?? []).find((p) => p.cmd === "UPDATE");
    const check = upd?.check ?? "";
    for (const t of ["patients", "consultants", "team_channels", "hospital_users"]) {
      expect(check, `containment for ${t} missing`).toContain(t);
    }
  });

  it("consult trigger freezes origin/content and enforces legal transitions", () => {
    const body = fn("enforce_consult_request_integrity");
    expect(trigger("enforce_consult_request_integrity", "consult_requests")).toBe(true);
    expect(body).toMatch(/SECURITY INVOKER/i);
    expect(body).toMatch(/SET search_path = public/i);
    for (const col of ["hospital_id", "patient_id", "requesting_user_id", "specialty", "reason", "created_at"]) {
      expect(body, `${col} not frozen`).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`);
    }
    expect(body).toMatch(/illegal consult status transition/);
    expect(body).toMatch(/closed consult requests are immutable/);
    expect(body).toMatch(/only involved parties may update this consult request/);
    // acceptance attribution is stamped, never supplied
    expect(body).toMatch(/NEW\.accepted_by\s*:=\s*COALESCE\(v_actor/);
    expect(body).toMatch(/consult acceptance attribution is immutable/);
  });

  // ---- direct messages ----
  it("direct messages are immutable except for a one-way read acknowledgement", () => {
    const body = fn("enforce_direct_message_integrity");
    expect(body).toMatch(/SECURITY INVOKER/i);
    for (const col of ["conversation_id", "sender_id", "content", "created_at"]) {
      expect(body, `${col} not frozen`).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`);
    }
    expect(body).toMatch(/NEW\.sender_id\s*:=\s*COALESCE\(auth\.uid\(\)/); // no sender spoofing
    expect(body).toMatch(/a read receipt cannot be withdrawn/);
    expect(body).toMatch(/senders cannot acknowledge their own messages/);
    expect(body).toMatch(/NEW\.read_at\s*:=\s*now\(\)/);
    expect(trigger("enforce_direct_message_integrity", "direct_messages")).toBe(true);
    expect(trigger("direct_messages_no_delete", "direct_messages")).toBe(true);
  });

  it("direct message UPDATE policy excludes the sender and only allows is_read = true", () => {
    const upd = (policies.get("direct_messages") ?? []).find((p) => p.cmd === "UPDATE");
    expect(upd?.expr).toMatch(/sender_id\s*<>\s*auth\.uid\(\)/);
    expect(upd?.check).toMatch(/is_read\s*=\s*true/);
    expect(upd?.check).toMatch(/sender_id\s*<>\s*auth\.uid\(\)/);
  });

  it("direct message INSERT binds sender to auth.uid() and proves conversation membership", () => {
    const ins = (policies.get("direct_messages") ?? []).find((p) => p.cmd === "INSERT");
    expect(ins?.check).toMatch(/sender_id\s*=\s*auth\.uid\(\)/);
    expect(ins?.check).toMatch(/participant_1\s*=\s*auth\.uid\(\)/);
    expect(ins?.check).toMatch(/hospital_users/);
  });

  // ---- team messages ----
  it("team messages are append-only for every client role", () => {
    const list = policies.get("team_messages") ?? [];
    expect(list.filter((p) => p.cmd === "UPDATE")).toHaveLength(0);
    expect(trigger("team_messages_append_only", "team_messages")).toBe(true);
    expect(trigger("stamp_team_message_sender", "team_messages")).toBe(true);
    expect(fn("stamp_team_message_sender")).toMatch(/NEW\.sender_id\s*:=\s*COALESCE\(auth\.uid\(\)/);
  });

  it("team message INSERT requires channel membership and hospital containment", () => {
    const ins = (policies.get("team_messages") ?? []).find((p) => p.cmd === "INSERT");
    expect(ins?.check).toMatch(/sender_id\s*=\s*auth\.uid\(\)/);
    expect(ins?.check).toMatch(/channel_members/);
    expect(ins?.check).toMatch(/hospital_users/);
  });

  // ---- acuity provenance ----
  it.each(["acuity_scores", "acuity_feedback"] as const)("%s: provenance is stamped and append-only", (table) => {
    expect(trigger("stamp_acuity_actor", table)).toBe(true);
    expect(trigger(`${table}_append_only`, table)).toBe(true);
    const ins = (policies.get(table) ?? []).find((p) => p.cmd === "INSERT");
    const actor = table === "acuity_scores" ? "created_by" : "recorded_by";
    expect(ins?.check).toMatch(new RegExp(`${actor}\\s*=\\s*auth\\.uid\\(\\)`));
    expect(ins?.check).toMatch(/hospital_users/);
  });

  it("acuity rows cannot reference a patient or score from another hospital", () => {
    const scores = (policies.get("acuity_scores") ?? []).find((p) => p.cmd === "INSERT")?.check ?? "";
    expect(scores).toMatch(/patients p[\s\S]*p\.hospital_id\s*=\s*acuity_scores\.hospital_id/);
    const fb = (policies.get("acuity_feedback") ?? []).find((p) => p.cmd === "INSERT")?.check ?? "";
    expect(fb).toMatch(/acuity_scores s[\s\S]*s\.hospital_id\s*=\s*acuity_feedback\.hospital_id/);
  });

  it("all new helper functions are SECURITY INVOKER with a fixed search_path", () => {
    for (const name of [
      "enforce_consult_request_integrity",
      "enforce_direct_message_integrity",
      "stamp_team_message_sender",
      "stamp_acuity_actor",
    ]) {
      expect(fn(name), `${name} must be invoker`).toMatch(/SECURITY INVOKER/i);
      expect(fn(name), `${name} must pin search_path`).toMatch(/SET search_path = public/i);
    }
  });
});
