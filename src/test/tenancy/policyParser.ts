/**
 * Minimal SQL reader for RLS regression tests.
 * Replays supabase/migrations in filename order and returns the effective
 * (last-write-wins) set of RLS policies per public table.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Policy {
  table: string;
  name: string;
  cmd: "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  /** USING + WITH CHECK expressions concatenated. */
  expr: string;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

/** Split on top-level semicolons, ignoring $$-quoted bodies and '...' literals. */
function statements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inDollar = false;
  let inQuote = false;
  while (i < sql.length) {
    const c = sql[i];
    if (!inQuote && sql.startsWith("$$", i)) {
      inDollar = !inDollar;
      buf += "$$";
      i += 2;
      continue;
    }
    if (!inDollar && c === "'") inQuote = !inQuote;
    if (c === ";" && !inDollar && !inQuote) {
      out.push(buf);
      buf = "";
    } else {
      buf += c;
    }
    i++;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

const unquote = (s: string) => s.replace(/^["']|["']$/g, "").trim();
const strip = (t: string) => t.replace(/^public\./i, "").replace(/["]/g, "").trim();

export function loadEffectivePolicies(): Map<string, Policy[]> {
  const byTable = new Map<string, Policy[]>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const raw of statements(sql)) {
      const stmt = raw.replace(/--[^\n]*/g, "").trim();

      const drop = /^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?("[^"]+"|\S+)\s+ON\s+(\S+)/is.exec(stmt);
      if (drop) {
        const table = strip(drop[2]);
        const name = unquote(drop[1]);
        byTable.set(table, (byTable.get(table) ?? []).filter((p) => p.name !== name));
        continue;
      }

      const create = /^CREATE\s+POLICY\s+("[^"]+"|\S+)\s+ON\s+(\S+)([\s\S]*)$/is.exec(stmt);
      if (!create) continue;
      const name = unquote(create[1]);
      const table = strip(create[2]);
      const rest = create[3];
      const cmd = (/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(rest)?.[1] ?? "ALL").toUpperCase() as Policy["cmd"];
      const using = /\bUSING\s*\(([\s\S]*?)\)\s*(?:WITH\s+CHECK|$)/i.exec(rest)?.[1] ?? "";
      const check = /\bWITH\s+CHECK\s*\(([\s\S]*)$/i.exec(rest)?.[1] ?? "";
      const list = byTable.get(table) ?? [];
      byTable.set(table, [...list.filter((p) => p.name !== name), { table, name, cmd, expr: `${using} ${check}` }]);
    }
  }
  return byTable;
}

/** True when the predicate constrains rows to the caller's hospital membership. */
export function isTenantScoped(expr: string): boolean {
  const e = expr.toLowerCase();
  return e.includes("hospital_users") || e.includes("user_hospital_ids") || e.includes("has_hospital_access");
}

/** True when the predicate is admin-only (acceptable: admins are cross-tenant by design). */
export function isAdminOnly(expr: string): boolean {
  const e = expr.replace(/\s+/g, " ").trim().toLowerCase();
  return /^has_role\(\s*auth\.uid\(\)\s*,\s*'admin'::app_role\s*\)$/.test(e);
}
