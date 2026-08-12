import { supabase } from '@/integrations/supabase/client';

/** Lifecycle the database enforces. `waitlisted` is chosen server-side, never by the UI. */
export const CARE_REQUEST_FLOW: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['triaged', 'declined', 'cancelled'],
  waitlisted: ['triaged', 'declined', 'cancelled'],
  triaged: ['scheduled', 'declined', 'cancelled'],
  scheduled: [],
  declined: [],
  cancelled: [],
};

export const CARE_REQUEST_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  waitlisted: 'Waitlisted',
  triaged: 'Triaged',
  scheduled: 'Scheduled',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export const CONSENT_VERSION = 'virtual-care-consent-2026.1';

/**
 * Conservative, static red-flag screen. It is deliberately NOT generated and
 * never interpreted by AI — an affirmative answer is a hard stop.
 * Service-specific questions live in `safety_screen_templates` and stay
 * inactive until a medical director approves them.
 */
export const SAFETY_SCREEN_VERSION = 1;
export const SAFETY_SCREEN_DISCLAIMER =
  'This screen is not a diagnosis and does not replace clinical judgment. If this is an emergency, call 911 or your local emergency number now.';

export const SAFETY_SCREEN_QUESTIONS: { code: string; text: string }[] = [
  { code: 'breathing', text: 'Severe difficulty breathing, or unable to speak in full sentences?' },
  { code: 'chest_pain', text: 'Chest pain, pressure or tightness right now?' },
  { code: 'stroke', text: 'Sudden one-sided weakness or numbness, face drooping, or trouble speaking or seeing?' },
  { code: 'bleeding', text: 'Bleeding that will not stop?' },
  { code: 'allergic', text: 'Swelling of the lips, tongue or throat, or a severe allergic reaction?' },
  { code: 'self_harm', text: 'Thoughts of harming yourself or ending your life?' },
  { code: 'pregnancy_emergency', text: 'If pregnant: heavy bleeding, severe abdominal pain, or the baby is not moving?' },
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI',
  'MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
] as const;

export class StaleCareRequestError extends Error {
  constructor() {
    super('This request changed in another window. Refresh and try again.');
    this.name = 'StaleCareRequestError';
  }
}

/**
 * Single enforced write path. Every prerequisite (state coverage, consent,
 * callback, red-flag stop, provider authorization) is owned by the database
 * trigger; `lock_version` gives optimistic concurrency.
 */
export async function updateCareRequest(
  id: string,
  lockVersion: number,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('care_requests')
    .update(patch as never)
    .eq('id', id)
    .eq('lock_version', lockVersion)
    .select('id, status, lock_version');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new StaleCareRequestError();
  return data[0];
}

/**
 * Reuse the existing appointment path, then let the trigger validate that the
 * provider is active for the service, licensed in the patient's state and that
 * appointment/patient/request all share the same facility.
 */
export async function scheduleCareRequest(req: {
  id: string;
  hospital_id: string;
  patient_id: string;
  lock_version: number;
  service_name: string;
}, providerId: string, startISO: string, durationMinutes = 20) {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const { data: appt, error } = await supabase
    .from('appointments')
    .insert([{
      patient_id: req.patient_id,
      hospital_id: req.hospital_id,
      provider_id: providerId,
      encounter_type: 'telehealth' as const,
      visit_reason: req.service_name,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: durationMinutes,
    }])
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  return updateCareRequest(req.id, req.lock_version, {
    assigned_provider_id: providerId,
    appointment_id: appt.id,
    status: 'scheduled',
  });
}
