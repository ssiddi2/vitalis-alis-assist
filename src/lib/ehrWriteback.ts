import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Resource = Record<string, unknown>;

export type WritebackOutcome =
  | { status: 'written'; id?: string; resourceType?: string }
  | { status: 'skipped'; reason?: string }
  | { status: 'not_configured'; reason: 'no_authoritative_facility_endpoint_binding' };

/**
 * Authoritative external-EHR binding for the ACTIVE facility.
 *
 * virtualisONE is standalone: an old SMART session in browser storage is NOT
 * evidence that this facility is provisioned to send data anywhere. There is no
 * authoritative per-facility endpoint record in the backend yet, so this always
 * resolves to `null` and every write fails closed with `not_configured`.
 *
 * This is deliberately NOT a browser-flippable boolean. Lifting it requires a
 * server-verified facility -> endpoint/issuer binding (see
 * docs/virtualis-one-unification.md).
 */
export interface WritebackBinding { facilityId: string; iss: string; accessToken: string }

export function resolveWritebackBinding(): WritebackBinding | null {
  return null;
}

/** True only when an authoritative binding exists. Currently always false. */
export const isExternalWritebackConfigured = (): boolean => resolveWritebackBinding() !== null;

const NOT_CONFIGURED: WritebackOutcome = {
  status: 'not_configured',
  reason: 'no_authoritative_facility_endpoint_binding',
};

const post = async (resourceType: string, resource: Resource): Promise<WritebackOutcome> => {
  const binding = resolveWritebackBinding();
  // Fail closed: no invoke, no toast, no implied delivery.
  if (!binding) return NOT_CONFIGURED;
  const { data, error } = await supabase.functions.invoke('fhir-writeback', {
    body: { iss: binding.iss, access_token: binding.accessToken, resourceType, resource },
  });
  if (error) {
    toast.error('EHR write-back failed');
    return { status: 'skipped', reason: 'invoke_failed' };
  }
  const res = data as WritebackOutcome;
  if (res.status === 'written') {
    toast.success(`Sent to EHR \u00b7 ${res.resourceType}/${res.id}`);
  } else if (res.status === 'skipped') {
    toast.message('EHR refused write \u2014 saved locally', { description: res.reason });
  }
  return res;
};

export const writeNoteToEhr = (patientId: string, title: string, body: string) =>
  post('DocumentReference', {
    resourceType: 'DocumentReference',
    status: 'current',
    type: { text: title },
    subject: { reference: `Patient/${patientId}` },
    date: new Date().toISOString(),
    content: [{ attachment: { contentType: 'text/plain', data: btoa(unescape(encodeURIComponent(body))) } }],
  });

export const writeMedicationOrderToEhr = (patientId: string, medText: string, rationale?: string) =>
  post('MedicationRequest', {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { text: medText },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: new Date().toISOString(),
    note: rationale ? [{ text: rationale }] : undefined,
  });

export const writeServiceRequestToEhr = (patientId: string, orderText: string, rationale?: string) =>
  post('ServiceRequest', {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    code: { text: orderText },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: new Date().toISOString(),
    note: rationale ? [{ text: rationale }] : undefined,
  });

export const writeCommunicationToEhr = (patientId: string, payloadText: string, topic = 'Specialist consult') =>
  post('Communication', {
    resourceType: 'Communication',
    status: 'completed',
    topic: { text: topic },
    subject: { reference: `Patient/${patientId}` },
    sent: new Date().toISOString(),
    payload: [{ contentString: payloadText }],
  });
