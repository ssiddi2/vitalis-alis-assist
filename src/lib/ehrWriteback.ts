import { supabase } from '@/integrations/supabase/client';
import { loadSmartSession } from '@/lib/smart';
import { toast } from 'sonner';

type Resource = Record<string, unknown>;

const post = async (resourceType: string, resource: Resource) => {
  const smart = loadSmartSession();
  if (!smart) return null; // no EHR linked; silent no-op
  const { data, error } = await supabase.functions.invoke('fhir-writeback', {
    body: { iss: smart.iss, access_token: smart.access_token, resourceType, resource },
  });
  if (error) {
    toast.error('EHR write-back failed');
    return null;
  }
  const res = data as { status: string; id?: string; resourceType?: string; reason?: string };
  if (res.status === 'written') {
    toast.success(`Sent to EHR · ${res.resourceType}/${res.id}`);
  } else if (res.status === 'skipped') {
    toast.message('EHR refused write — saved locally', { description: res.reason });
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
