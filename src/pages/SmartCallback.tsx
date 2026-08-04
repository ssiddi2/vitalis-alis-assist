import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSmartClientId, SMART_STORAGE_KEY, type SmartSession } from '@/lib/smart';

export default function SmartCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const code = params.get('code');
        const state = params.get('state');
        const errParam = params.get('error');
        if (errParam) throw new Error(`${errParam}: ${params.get('error_description') || ''}`);
        if (!code) throw new Error('Missing authorization code');

        const raw = sessionStorage.getItem('smart_pkce');
        if (!raw) throw new Error('Missing PKCE state — restart from EHR');
        const pkce = JSON.parse(raw) as {
          iss: string; verifier: string; state: string; token_endpoint: string; redirect_uri: string;
        };
        if (state !== pkce.state) throw new Error('State mismatch');

        const { data, error } = await supabase.functions.invoke('smart-token', {
          body: {
            token_endpoint: pkce.token_endpoint,
            iss: pkce.iss,
            code,
            code_verifier: pkce.verifier,
            redirect_uri: pkce.redirect_uri,
            client_id: getSmartClientId(),
          },
        });
        if (error) throw error;
        const t = data as {
          access_token: string; patient?: string; encounter?: string;
          expires_in?: number; patient_resource?: Record<string, unknown>;
          bundle?: SmartSession['bundle'];
        };

        const session: SmartSession = {
          iss: pkce.iss,
          access_token: t.access_token,
          patient_id: t.patient,
          encounter_id: t.encounter,
          patient: t.patient_resource,
          bundle: t.bundle,
          expires_at: Date.now() + (t.expires_in ?? 3600) * 1000,
        };
        sessionStorage.setItem(SMART_STORAGE_KEY, JSON.stringify(session));
        sessionStorage.removeItem('smart_pkce');
        navigate('/dashboard?smart=1', { replace: true });
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Callback failed');
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
      {err ? <span className="text-critical">SMART callback error: {err}</span> : 'Completing EHR launch…'}
    </div>
  );
}
