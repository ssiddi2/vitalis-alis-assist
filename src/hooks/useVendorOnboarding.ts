import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import type { VendorKey, VendorState } from '@/lib/vendorRegistry';

export interface VendorOnboarding {
  id: string;
  hospital_id: string;
  vendor_key: VendorKey;
  environment: 'sandbox' | 'production';
  state: VendorState;
  owner_name: string | null;
  owner_email: string | null;
  blocker: string | null;
  next_action: string | null;
  secret_ref_names: string[];
  checklist: Record<string, boolean>;
  capabilities: Record<string, unknown>;
  contract_evidence_hash: string | null;
  credential_evidence_hash: string | null;
  certification_evidence_hash: string | null;
  approval_evidence_hash: string | null;
  evidence_expires_at: string | null;
  last_test_at: string | null;
  last_test_result: string | null;
}

/** Vendor launch-integration state. Read-only mirror of the server-authoritative gates. */
export function useVendorOnboarding(hospitalId?: string) {
  const [rows, setRows] = useState<VendorOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('vendor_onboarding')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('vendor_key')
      .order('environment', { ascending: false });
    setRows((data as unknown as VendorOnboarding[]) || []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const call = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await authenticatedFetch<Record<string, unknown>>('integration-gateway', {
      body: { hospital_id: hospitalId, ...body },
    });
    setBusy(false);
    return res;
  }, [hospitalId]);

  const seed = useCallback(async () => {
    const res = await call({ action: 'seed_templates' });
    if (!res.error) await refresh();
    return res;
  }, [call, refresh]);

  const testConnection = useCallback(async (vendor_key: VendorKey, capability: string) => {
    const res = await call({ action: 'test_connection', vendor_key, capability });
    await refresh();
    return res;
  }, [call, refresh]);

  const exportPacket = useCallback(
    (vendor_key: VendorKey) => call({ action: 'export_packet', vendor_key }),
    [call],
  );

  const update = useCallback(async (id: string, patch: Partial<VendorOnboarding>) => {
    const { error } = await supabase.from('vendor_onboarding').update(patch as never).eq('id', id);
    await refresh();
    return error?.message ?? null;
  }, [refresh]);

  return { rows, loading, busy, refresh, seed, testConnection, exportPacket, update };
}
