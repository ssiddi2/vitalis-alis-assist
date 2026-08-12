import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Live cross-tenant RLS proof (opt-in).
 *
 * Runs only when credentials for a clinician at hospital A and a known
 * hospital B row set are provided. In CI these come from repository secrets;
 * locally / without them the suite is skipped so the offline policy gate in
 * rls-policies.test.ts remains the always-on protection.
 */
const url = process.env.RLS_TEST_SUPABASE_URL;
const anonKey = process.env.RLS_TEST_ANON_KEY;
const email = process.env.RLS_TEST_A_EMAIL;
const password = process.env.RLS_TEST_A_PASSWORD;
const hospitalB = process.env.RLS_TEST_HOSPITAL_B_ID;
const patientB = process.env.RLS_TEST_PATIENT_B_ID;

const enabled = Boolean(url && anonKey && email && password && hospitalB && patientB);

/** patient_id-scoped PHI tables + hospital_id-scoped tables. */
const BY_PATIENT = [
  "immunizations",
  "patient_allergies",
  "patient_medications",
  "patient_problems",
  "patient_vitals",
  "clinical_notes",
  "staged_orders",
  "prescriptions",
  "lab_results",
] as const;

describe.skipIf(!enabled)("live RLS: clinician at hospital A cannot touch hospital B data", () => {
  let db: SupabaseClient;

  beforeAll(async () => {
    db = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email: email!, password: password! });
    expect(error).toBeNull();
  });

  it("cannot SELECT hospital B patients", async () => {
    const { data } = await db.from("patients").select("id").eq("hospital_id", hospitalB!);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot UPDATE or DELETE hospital B patients", async () => {
    const upd = await db.from("patients").update({ status: "tampered" }).eq("hospital_id", hospitalB!).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const del = await db.from("patients").delete().eq("hospital_id", hospitalB!).select("id");
    expect(del.error || (del.data ?? []).length === 0).toBeTruthy();
  });

  it("cannot INSERT a patient into hospital B", async () => {
    const res = await db.from("patients").insert({
      name: "RLS Probe",
      mrn: `rls-${Date.now()}`,
      age: 40,
      sex: "M",
      admission_day: 1,
      expected_los: 1,
      hospital_id: hospitalB,
    }).select("id");
    expect(res.error || (res.data ?? []).length === 0).toBeTruthy();
  });

  it.each(BY_PATIENT)("cannot SELECT/UPDATE/DELETE hospital B %s", async (table) => {
    const sel = await db.from(table).select("id").eq("patient_id", patientB!);
    expect(sel.data ?? []).toHaveLength(0);
    const del = await db.from(table).delete().eq("patient_id", patientB!).select("id");
    expect(del.error || (del.data ?? []).length === 0).toBeTruthy();
  });

  it.each(["note_templates", "order_sets"] as const)("cannot read hospital B %s", async (table) => {
    const { data } = await db.from(table).select("id").eq("hospital_id", hospitalB!);
    expect(data ?? []).toHaveLength(0);
  });
});
