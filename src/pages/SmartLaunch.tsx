import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { discoverSmart, randomString, sha256, isHttpsUrl, smartIssAllowed, SMART_CLIENT_ID, SMART_SCOPES } from '@/lib/smart';

export default function SmartLaunch() {
  const [params] = useSearchParams();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const iss = params.get('iss');
        const launch = params.get('launch');
        if (!iss) throw new Error('Missing iss parameter');

        const cfg = await discoverSmart(iss);

        const state = randomString(32);
        const verifier = randomString(64);
        const challenge = await sha256(verifier);
        const redirect_uri = `${window.location.origin}/smart/callback`;

        sessionStorage.setItem('smart_pkce', JSON.stringify({
          iss, verifier, state, token_endpoint: cfg.token_endpoint, redirect_uri,
        }));

        const url = new URL(cfg.authorization_endpoint);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', SMART_CLIENT_ID);
        url.searchParams.set('redirect_uri', redirect_uri);
        url.searchParams.set('scope', SMART_SCOPES);
        url.searchParams.set('state', state);
        url.searchParams.set('aud', iss);
        url.searchParams.set('code_challenge', challenge);
        url.searchParams.set('code_challenge_method', 'S256');
        if (launch) url.searchParams.set('launch', launch);

        window.location.replace(url.toString());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Launch failed');
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      {err ? <span className="text-critical">SMART launch error: {err}</span> : 'Launching from EHR…'}
    </div>
  );
}
