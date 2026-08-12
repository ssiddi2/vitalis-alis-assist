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
/** Optional: a SIGNED note in the caller's own hospital, to prove deletion is refused. */
const signedNote = process.env.RLS_TEST_SIGNED_NOTE_ID;

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

  it("cannot INSERT PHI rows for a hospital B patient", async () => {
    const notes = await db.from("clinical_notes").insert({
      patient_id: patientB, note_type: "progress", content: { probe: true }, status: "draft",
    }).select("id");
    expect(notes.error || (notes.data ?? []).length === 0).toBeTruthy();

    const vitals = await db.from("patient_vitals").insert({
      patient_id: patientB, insights: {}, trends: {},
    }).select("id");
    expect(vitals.error || (vitals.data ?? []).length === 0).toBeTruthy();
  });

  it("cannot UPDATE hospital B vitals or re-point them at a hospital B patient", async () => {
    const upd = await db.from("patient_vitals").update({ insights: { probe: true } }).eq("patient_id", patientB!).select("id");
    expect(upd.error || (upd.data ?? []).length === 0).toBeTruthy();

    const mine = await db.from("patient_vitals").select("id").limit(1);
    if ((mine.data ?? []).length) {
      const move = await db.from("patient_vitals").update({ patient_id: patientB }).eq("id", mine.data![0].id).select("id");
      expect(move.error || (move.data ?? []).length === 0).toBeTruthy();
    }
  });

  it("cannot create a consultation note for a hospital B thread", async () => {
    const res = await db.from("consultation_notes").insert({
      thread_id: crypto.randomUUID(), patient_id: patientB, generated_by: "probe", status: "draft",
    }).select("id");
    expect(res.error || (res.data ?? []).length === 0).toBeTruthy();
  });

  it.skipIf(!signedNote)("cannot delete a SIGNED note, even in its own hospital", async () => {
    const del = await db.from("clinical_notes").delete().eq("id", signedNote!).select("id");
    expect(del.error || (del.data ?? []).length === 0).toBeTruthy();
    const still = await db.from("clinical_notes").select("id").eq("id", signedNote!);
    expect((still.data ?? []).length).toBe(1);
  });

  it.each(["note_versions", "note_addenda"] as const)("cannot delete %s", async (table) => {
    const del = await db.from(table).delete().neq("id", crypto.randomUUID()).select("id");
    expect(del.error || (del.data ?? []).length === 0).toBeTruthy();
  });

  it.each(["note_templates", "order_sets"] as const)("cannot read hospital B %s", async (table) => {
    const { data } = await db.from(table).select("id").eq("hospital_id", hospitalB!);
    expect(data ?? []).toHaveLength(0);
  });
});

describe.skipIf(!enabled)("live RLS: scheduling & collaboration writes stay in-tenant", () => {
  let db: SupabaseClient;
  let uid: string;

  beforeAll(async () => {
    db = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await db.auth.signInWithPassword({ email: email!, password: password! });
    expect(error).toBeNull();
    uid = data.user!.id;
  });

  const denied = (res: { error: unknown; data: unknown[] | null }) =>
    expect(res.error || (res.data ?? []).length === 0).toBeTruthy();

  it("cannot create an encounter in hospital B", async () => {
    denied(await db.from("encounters").insert({
      patient_id: patientB, provider_id: uid, hospital_id: hospitalB,
      encounter_type: "office_visit", status: "scheduled",
    }).select("id"));
  });

  it("cannot create an appointment in hospital B", async () => {
    const now = new Date().toISOString();
    denied(await db.from("appointments").insert({
      patient_id: patientB, provider_id: uid, hospital_id: hospitalB,
      encounter_type: "office_visit", start_time: now, end_time: now,
      duration_minutes: 15, status: "scheduled",
    }).select("id"));
  });

  it("cannot create a consult request in hospital B", async () => {
    denied(await db.from("consult_requests").insert({
      patient_id: patientB, hospital_id: hospitalB, requesting_user_id: uid,
      specialty: "cardiology", urgency: "routine", reason: "probe", status: "pending",
    }).select("id"));
  });

  it("cannot create a consultation thread in hospital B", async () => {
    denied(await db.from("consultation_threads").insert({
      patient_id: patientB, hospital_id: hospitalB, primary_clinician_id: uid,
      ai_participant_id: "alis", specialty: "cardiology", reason: "probe",
      shared_context: {}, status: "active",
    }).select("id"));
  });

  it("cannot create a team channel in hospital B, nor impersonate another creator", async () => {
    denied(await db.from("team_channels").insert({
      hospital_id: hospitalB, name: "probe", channel_type: "department", created_by: uid,
    }).select("id"));
    denied(await db.from("team_channels").insert({
      hospital_id: hospitalB, name: "probe", channel_type: "department",
      created_by: crypto.randomUUID(),
    }).select("id"));
  });

  it("cannot move an own-hospital channel or appointment into hospital B", async () => {
    const ch = await db.from("team_channels").select("id").limit(1);
    if ((ch.data ?? []).length) {
      denied(await db.from("team_channels").update({ hospital_id: hospitalB }).eq("id", ch.data![0].id).select("id"));
    }
    const ap = await db.from("appointments").select("id").limit(1);
    if ((ap.data ?? []).length) {
      denied(await db.from("appointments").update({ patient_id: patientB }).eq("id", ap.data![0].id).select("id"));
    }
  });
});
