import { supabase } from '@/integrations/supabase/client';

export interface TransmitResult {
  status: 'queued' | 'blocked' | 'sent' | 'error';
  reason?: string;
  schedule?: 'II' | 'III' | 'IV' | 'V';
}

async function transmit(payload: Record<string, unknown>): Promise<TransmitResult> {
  const { data, error } = await supabase.functions.invoke('order-transmit', { body: payload });
  if (error) return { status: 'error', reason: error.message };
  return data as TransmitResult;
}

export const eprescribe = (prescription_id: string, hospital_id: string, drug_name: string) =>
  transmit({ action: 'eprescribe', prescription_id, hospital_id, drug_name });

export const labOrder = (order_id: string, hospital_id: string) =>
  transmit({ action: 'lab_order', order_id, hospital_id });

/** Human-readable, never-fake status copy. */
export const TRANSMIT_COPY: Record<string, { label: string; tone: 'info' | 'blocked' | 'success' | 'error' }> = {
  queued: { label: 'Queued · no e-Rx network connected', tone: 'info' },
  blocked: { label: 'Controlled substance — e-prescribing disabled pending DEA EPCS certification', tone: 'blocked' },
  sent: { label: 'Sent to pharmacy', tone: 'success' },
  error: { label: 'Transmission unavailable', tone: 'error' },
};
