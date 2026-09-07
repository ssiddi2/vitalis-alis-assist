import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Standalone safety: a stale SMART session in browser storage must never cause
 * an external write, and local signing must never audit an external push.
 */
const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

// A stale SMART session exists — the pre-fix trigger for auto-sending.
vi.mock('@/lib/smart', () => ({
  loadSmartSession: () => ({ iss: 'https://old-issuer.example/fhir', access_token: 'stale', patient_id: 'ext-p1' }),
}));

import {
  isExternalWritebackConfigured,
  resolveWritebackBinding,
  writeNoteToEhr,
  writeMedicationOrderToEhr,
  writeServiceRequestToEhr,
  writeCommunicationToEhr,
} from '@/lib/ehrWriteback';
import { signAndPushOrder } from '@/lib/orderLifecycle';
import type { StagedOrder } from '@/types/hospital';

beforeEach(() => invoke.mockReset());

describe('external write-back fails closed while standalone', () => {
  it('has no authoritative binding and reports not configured', () => {
    expect(resolveWritebackBinding()).toBeNull();
    expect(isExternalWritebackConfigured()).toBe(false);
  });

  it('performs zero write-back invocations despite a stale SMART session', async () => {
    const results = await Promise.all([
      writeNoteToEhr('ext-p1', 'Progress Note', 'body'),
      writeMedicationOrderToEhr('ext-p1', 'semaglutide'),
      writeServiceRequestToEhr('ext-p1', 'CBC'),
      writeCommunicationToEhr('ext-p1', 'summary'),
    ]);
    expect(invoke).not.toHaveBeenCalled();
    for (const r of results) {
      expect(r).toEqual({ status: 'not_configured', reason: 'no_authoritative_facility_endpoint_binding' });
    }
  });

  it('local order signing stays local and does not audit an external push', async () => {
    const audits: Array<{ action: string; meta?: Record<string, unknown> }> = [];
    const order = {
      id: 'staged-1',
      patient_id: 'p-1',
      order_type: 'medication',
      order_data: { name: 'semaglutide' },
      rationale: null,
    } as unknown as StagedOrder;

    const out = await signAndPushOrder(order, 'u-1', (action, _t, _id, _p, meta) => audits.push({ action, meta }));

    expect(out.status).toBe('signed');
    expect(invoke).not.toHaveBeenCalled();
    expect(audits.map((a) => a.action)).toEqual(['order.signed_local']);
    expect(audits.some((a) => a.action === 'order.push_to_ehr')).toBe(false);
  });
});
