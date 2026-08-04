// Minimal SMART-on-FHIR PKCE helpers
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const randomString = (len = 64) => {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return b64url(a.buffer).slice(0, len);
};

export const sha256 = async (s: string) =>
  b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

export interface SmartConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  capabilities?: string[];
}

export const isHttpsUrl = (u?: string) => {
  try { return new URL(u!).protocol === 'https:'; } catch { return false; }
};

/** Issuer allowlist from VITE_SMART_ISS_ALLOWLIST (comma-separated hosts). Empty = https-only. */
export const smartIssAllowed = (iss: string) => {
  if (!isHttpsUrl(iss)) return false;
  const list = ((import.meta.env.VITE_SMART_ISS_ALLOWLIST as string) || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const host = new URL(iss).host.toLowerCase();
  return list.some(a => host === a.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
};

export const discoverSmart = async (iss: string): Promise<SmartConfig> => {
  if (!smartIssAllowed(iss)) throw new Error('Issuer is not an allowed https FHIR server');
  const base = iss.replace(/\/$/, '');
  const r = await fetch(`${base}/.well-known/smart-configuration`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`SMART discovery failed: ${r.status}`);
  const cfg = (await r.json()) as SmartConfig;
  if (!isHttpsUrl(cfg.authorization_endpoint) || !isHttpsUrl(cfg.token_endpoint)) {
    throw new Error('SMART endpoints must use https');
  }
  return cfg;
};

// Demo default = public Epic-style sandbox client. Override via VITE_SMART_CLIENT_ID.
export const SMART_CLIENT_ID =
  (import.meta.env.VITE_SMART_CLIENT_ID as string) || 'alis-demo-client';

export const SMART_SCOPES =
  'launch openid fhirUser offline_access patient/Patient.read patient/Observation.read patient/Condition.read patient/MedicationRequest.read patient/AllergyIntolerance.read user/DocumentReference.write user/MedicationRequest.write user/ServiceRequest.write user/Communication.write';

export interface SmartSession {
  iss: string;
  access_token: string;
  patient_id?: string;
  encounter_id?: string;
  patient?: Record<string, unknown>;
  bundle?: {
    conditions?: Record<string, unknown>[];
    medications?: Record<string, unknown>[];
    allergies?: Record<string, unknown>[];
    vitals?: Record<string, unknown>[];
  };
  expires_at: number;
}

export const SMART_STORAGE_KEY = 'smart_session';

export const loadSmartSession = (): SmartSession | null => {
  try {
    const raw = sessionStorage.getItem(SMART_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SmartSession;
    if (s.expires_at && s.expires_at < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
};
