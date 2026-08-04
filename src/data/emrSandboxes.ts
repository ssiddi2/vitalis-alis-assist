/**
 * Curated EMR sandbox presets for SMART-on-FHIR demos.
 * SYNTHETIC TEST PATIENTS ONLY. No free-text issuer entry is offered anywhere in
 * the UI — the launch flow may only receive one of these vetted issuers, and the
 * server still enforces its own allowlist (ENABLE_FHIR_SANDBOX / ALLOWED_FHIR_ISS).
 */
export interface EmrSandbox {
  id: string;
  label: string;
  iss: string;
  requiresClientId: boolean;
  docsUrl: string;
  helper: string;
}

export const EMR_SANDBOXES: readonly EmrSandbox[] = [
  {
    id: 'smart-health-it',
    label: 'SMART Health IT (instant demo)',
    iss: 'https://launch.smarthealthit.org/v/r4/fhir',
    requiresClientId: false,
    docsUrl: 'https://launch.smarthealthit.org',
    helper:
      'Open reference sandbox with synthetic patients (e.g. Gregory House, Angela Montgomery). No registration — any client id works for a public PKCE client.',
  },
  {
    id: 'epic',
    label: 'Epic Sandbox',
    iss: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    requiresClientId: true,
    docsUrl: 'https://fhir.epic.com',
    helper:
      'Epic on FHIR test patients (e.g. Camila Lopez, Derrick Lin). Register the app at fhir.epic.com, add the redirect URI below, and paste the non-production client ID.',
  },
  {
    id: 'cerner',
    label: 'Oracle Health / Cerner Sandbox',
    iss: 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    requiresClientId: true,
    docsUrl: 'https://code.cerner.com',
    helper:
      'Standard Cerner sandbox tenant with synthetic patients (e.g. Nancy Smart). Register at code.cerner.com, add the redirect URI below, and paste the issued client ID.',
  },
] as const;

export const EMR_PRESET_KEY = 'emr_sandbox_preset';
export const EMR_CLIENT_ID_KEY = 'emr_sandbox_client_id';

/**
 * Facility EMR flavour → sandbox preset used for NON-PRODUCTION demos only.
 * Meditech has no public sandbox, so it demos against the SMART reference server.
 * Real deployments must configure the facility's own issuer (ALLOWED_FHIR_ISS).
 */
export const SANDBOX_FOR_EMR: Record<string, string> = {
  epic: 'epic',
  cerner: 'cerner',
  meditech: 'smart-health-it',
};

export const sandboxForEmr = (emr?: string | null): EmrSandbox | undefined =>
  EMR_SANDBOXES.find(s => s.id === SANDBOX_FOR_EMR[emr ?? '']);
