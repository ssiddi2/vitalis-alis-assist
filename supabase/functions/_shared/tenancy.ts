import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * Tenancy guards for the service-role client.
 *
 * The service-role client bypasses RLS, so ANY caller-supplied record id
 * (patient_id, note_id, order_id, prescription_id, …) must be proven to belong
 * to the caller's hospital before it is read or written. These helpers are the
 * single place that check is expressed.
 */

/** True if the patient exists AND belongs to the given hospital. */
export async function patientInHospital(
  admin: SupabaseClient,
  patientId: string,
  hospitalId: string,
): Promise<boolean> {
  if (!patientId || !hospitalId) return false;
  const { data } = await admin
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  return !!data;
}

/**
 * True if a patient-owned row (prescriptions, staged_orders, clinical_notes, …)
 * belongs to a patient in the given hospital. Uses an inner join so the scope is
 * enforced by the query itself, not by a separate round-trip.
 */
export async function ownedByHospital(
  admin: SupabaseClient,
  table: string,
  id: string,
  hospitalId: string,
): Promise<boolean> {
  if (!id || !hospitalId) return false;
  const { data } = await admin
    .from(table)
    .select("id, patients!inner(hospital_id)")
    .eq("id", id)
    .eq("patients.hospital_id", hospitalId)
    .maybeSingle();
  return !!data;
}
