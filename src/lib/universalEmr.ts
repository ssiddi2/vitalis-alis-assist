import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SyncEvent = {
  id: string;
  ts: number;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  patientName?: string;
  payload: unknown;
  status: 'ok' | 'error';
  error?: string;
};

type Listener = (events: SyncEvent[]) => void;
const events: SyncEvent[] = [];
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(events.slice()));

export const subscribeEmrFeed = (l: Listener) => {
  listeners.add(l);
  l(events.slice());
  return () => listeners.delete(l);
};
export const getEmrFeed = () => events.slice();
export const clearEmrFeed = () => { events.length = 0; emit(); };

export const pushToUniversalEmr = async (
  resource: any,
  opts: { patientId?: string; patientName?: string; hospitalId?: string } = {},
) => {
  const id = crypto.randomUUID();
  const ts = Date.now();
  try {
    const { data, error } = await supabase.functions.invoke('fhir-ingest', {
      body: { resource, patient_id: opts.patientId, hospital_id: opts.hospitalId },
    });
    if (error) throw error;
    const res = data as { id: string; resourceType: string };
    events.unshift({
      id, ts, status: 'ok',
      resourceType: res.resourceType,
      resourceId: res.id,
      patientId: opts.patientId,
      patientName: opts.patientName,
      payload: { ...resource, id: res.id },
    });
    events.splice(20);
    emit();
    toast.success(`Sent to EMR Sandbox · ${res.resourceType}/${res.id.slice(0, 8)}`);
    return res;
  } catch (e) {
    const err = (e as Error).message;
    events.unshift({
      id, ts, status: 'error', error: err,
      resourceType: resource?.resourceType ?? 'Unknown',
      resourceId: '—', patientId: opts.patientId, patientName: opts.patientName, payload: resource,
    });
    events.splice(20);
    emit();
    toast.error(`EMR Sandbox push failed: ${err}`);
    return null;
  }
};

// FHIR R4 builders
const ref = (pid: string) => ({ reference: `Patient/${pid}` });
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export const buildDocumentReference = (patientId: string, title: string, body: string) => ({
  resourceType: 'DocumentReference',
  status: 'current',
  type: { text: title },
  subject: ref(patientId),
  date: new Date().toISOString(),
  content: [{ attachment: { contentType: 'text/plain', data: b64(body), title } }],
});

export const buildCondition = (patientId: string, code: string, display: string, onset?: string) => ({
  resourceType: 'Condition',
  clinicalStatus: { coding: [{ code: 'active' }] },
  code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code, display }], text: display },
  subject: ref(patientId),
  onsetDateTime: onset ?? new Date().toISOString(),
});

export const buildMedicationRequest = (patientId: string, medText: string, dosage?: string) => ({
  resourceType: 'MedicationRequest',
  status: 'active',
  intent: 'order',
  medicationCodeableConcept: { text: medText },
  subject: ref(patientId),
  authoredOn: new Date().toISOString(),
  dosageInstruction: dosage ? [{ text: dosage }] : undefined,
});

export const buildObservation = (patientId: string, code: string, display: string, value: number, unit: string) => ({
  resourceType: 'Observation',
  status: 'final',
  category: [{ coding: [{ code: 'vital-signs', display: 'Vital Signs' }] }],
  code: { coding: [{ system: 'http://loinc.org', code, display }], text: display },
  subject: ref(patientId),
  effectiveDateTime: new Date().toISOString(),
  valueQuantity: { value, unit },
});

/** Pushes a snapshot of the patient chart as separate FHIR resources. */
export const pushChartSnapshot = async (patientId: string, patientName?: string) => {
  const opts = { patientId, patientName };
  const [problems, meds, vitals] = await Promise.all([
    supabase.from('patient_problems').select('icd10_code, description, onset_date').eq('patient_id', patientId).eq('status', 'active'),
    supabase.from('patient_medications').select('name, dose, frequency').eq('patient_id', patientId).eq('status', 'active'),
    supabase.from('patient_vitals').select('*').eq('patient_id', patientId).order('recorded_at', { ascending: false }).limit(1),
  ]);

  let count = 0;
  for (const p of (problems.data ?? []) as any[]) {
    await pushToUniversalEmr(buildCondition(patientId, p.icd10_code ?? '', p.description ?? '', p.onset_date ?? undefined), opts);
    count++;
  }
  for (const m of (meds.data ?? []) as any[]) {
    await pushToUniversalEmr(buildMedicationRequest(patientId, m.name ?? '', [m.dose, m.frequency].filter(Boolean).join(' ')), opts);
    count++;
  }
  const v = vitals.data?.[0] as any;
  if (v) {
    const obs: Array<[string, string, number | null, string]> = [
      ['8867-4', 'Heart rate', v.heart_rate, 'bpm'],
      ['8480-6', 'Systolic BP', v.systolic_bp, 'mmHg'],
      ['8462-4', 'Diastolic BP', v.diastolic_bp, 'mmHg'],
      ['2708-6', 'SpO2', v.spo2, '%'],
      ['8310-5', 'Temperature', v.temperature, '°F'],
    ];
    for (const [code, disp, val, unit] of obs) {
      if (val == null) continue;
      await pushToUniversalEmr(buildObservation(patientId, code, disp, Number(val), unit), opts);
      count++;
    }
  }
  return count;
};
