import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MfaFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

/** Shared TOTP helpers. Supabase handles all MFA server-side. */
export function useMfaFactors() {
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setError(error ? error.message : null);
    setFactors((data?.totp as MfaFactor[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const verified = factors.filter(f => f.status === 'verified');
  return { factors, verified, enabled: verified.length > 0, loading, error, refresh };
}

/** Challenge + verify a TOTP factor. Throws on failure. */
export async function challengeAndVerify(factorId: string, code: string) {
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) throw chErr;
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: ch.id,
    code,
  });
  if (vErr) throw vErr;
}
